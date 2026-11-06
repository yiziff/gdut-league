"""FIBA 记录表切格工具。

calibrate <空白表> <layout.json> [blank.jpg]
    从空白标准表标定累积分区格线和最后比分区，写入 layout.json
extract <照片> <输出目录> [--corners x1,y1,x2,y2,x3,y3,x4,y4] [--layout layout.json]
    拉正照片、切出写了字的累积分号码格，结果 JSON 输出到 stdout
"""

import json
import os
import sys

import cv2
import numpy as np

CANVAS_W = 2000
CANVAS_H = 2830
ROWS = 40
BLOCKS = 4
SCORE_COLUMNS = BLOCKS * 4
INK_THRESHOLD = 0.04
DEFAULT_LAYOUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "server", "fiba", "layout.json")


class SheetError(Exception):
    def __init__(self, reason, message):
        super().__init__(message)
        self.reason = reason
        self.message = message


def emit(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.stdout.write("\n")


def read_image(path):
    data = np.fromfile(path, dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if image is None:
        raise SheetError("read", "图片无法读取")
    return image


def order_corners(points):
    points = np.array(points, dtype=np.float32).reshape(4, 2)
    total = points.sum(axis=1)
    diff = np.diff(points, axis=1).ravel()
    return np.array(
        [points[np.argmin(total)], points[np.argmin(diff)], points[np.argmax(total)], points[np.argmax(diff)]],
        dtype=np.float32,
    )


def binary_ink(gray):
    return cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 31, 12)


def line_masks(binary, scale):
    height, width = binary.shape
    horizontal = cv2.morphologyEx(
        binary, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (max(10, width // scale), 1))
    )
    vertical = cv2.morphologyEx(
        binary, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(10, height // scale)))
    )
    return horizontal, vertical


def find_form_corners(image):
    """表格最外圈的框：横竖线叠加后面积最大的轮廓。"""
    height, width = image.shape[:2]
    scale = min(1.0, 1600 / max(height, width))
    small = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1 else image
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    horizontal, vertical = line_masks(binary_ink(gray), 25)
    grid = cv2.dilate(cv2.bitwise_or(horizontal, vertical), np.ones((5, 5), np.uint8))
    contours, _ = cv2.findContours(grid, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    image_area = gray.shape[0] * gray.shape[1]
    best = None
    best_area = 0
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < image_area * 0.15 or area <= best_area:
            continue
        hull = cv2.convexHull(contour)
        approx = cv2.approxPolyDP(hull, 0.02 * cv2.arcLength(hull, True), True)
        if len(approx) != 4:
            approx = cv2.boxPoints(cv2.minAreaRect(hull)).reshape(-1, 1, 2)
        best = approx
        best_area = area
    if best is None:
        return None
    return order_corners(best.reshape(4, 2) / scale)


def warp(image, corners):
    target = np.array([[0, 0], [CANVAS_W - 1, 0], [CANVAS_W - 1, CANVAS_H - 1], [0, CANVAS_H - 1]], dtype=np.float32)
    matrix = cv2.getPerspectiveTransform(order_corners(corners), target)
    return cv2.warpPerspective(
        image, matrix, (CANVAS_W, CANVAS_H), flags=cv2.INTER_CUBIC, borderValue=(255, 255, 255)
    )


def peaks(profile, threshold, min_gap):
    """一维投影里超过阈值的连续段取中心，距离太近的合并。"""
    found = []
    start = None
    for index, value in enumerate(profile):
        if value >= threshold and start is None:
            start = index
        elif value < threshold and start is not None:
            found.append((start + index - 1) / 2)
            start = None
    if start is not None:
        found.append((start + len(profile) - 1) / 2)
    merged = []
    for value in found:
        if merged and value - merged[-1] < min_gap:
            merged[-1] = (merged[-1] + value) / 2
        else:
            merged.append(value)
    return merged


def locate_columns(vertical, reference):
    found = [CANVAS_W // 2 + value for value in peaks(vertical[:, CANVAS_W // 2 :].sum(axis=0) / 255, CANVAS_H * 0.25, 12)]
    if reference is None:
        if len(found) < SCORE_COLUMNS + 1:
            raise SheetError("calibrate", f"累积分区竖线只找到 {len(found)} 条")
        columns = found[-(SCORE_COLUMNS + 1) :]
        gaps = np.diff(columns)
        if gaps.std() / gaps.mean() > 0.25:
            raise SheetError("calibrate", "累积分区竖线间距不均匀")
        return columns, SCORE_COLUMNS + 1
    step = (reference[-1] - reference[0]) / SCORE_COLUMNS
    snapped = []
    hits = 0
    for expected in reference:
        near = [value for value in found if abs(value - expected) <= step * 0.4]
        if near:
            snapped.append(min(near, key=lambda value: abs(value - expected)))
            hits += 1
        else:
            snapped.append(None)
    offsets = [value - reference[index] for index, value in enumerate(snapped) if value is not None]
    shift = float(np.median(offsets)) if offsets else 0.0
    return [value if value is not None else reference[index] + shift for index, value in enumerate(snapped)], hits


def locate_rows(horizontal, columns, reference_pitch):
    """以累积分区底线为基准往上逐行贴线。只用印好累计分的两列，手写号码干扰少。"""
    spans = []
    for block in range(BLOCKS):
        spans.append((int(columns[block * 4 + 1]) + 4, int(columns[block * 4 + 3]) - 4))
    width = sum(right - left for left, right in spans)
    profile = sum(horizontal[:, left:right].sum(axis=1) for left, right in spans) / 255
    lines = peaks(profile, width * 0.45, 8)
    if len(lines) < 10:
        raise SheetError("align", "累积分区的横线太少")

    gaps = np.diff(lines)
    usable = gaps[(gaps > reference_pitch * 0.7) & (gaps < reference_pitch * 1.35)]
    pitch = float(np.median(usable)) if len(usable) else reference_pitch

    def near(target, tolerance):
        candidates = [value for value in lines if abs(value - target) <= tolerance]
        return min(candidates, key=lambda value: abs(value - target)) if candidates else None

    bottom = None
    for value in reversed(lines):
        if value < CANVAS_H * 0.45:
            break
        below = near(value + pitch, pitch * 0.3)
        above = [near(value - pitch * step, pitch * 0.3) for step in (1, 2, 3)]
        if below is None and sum(item is not None for item in above) >= 2:
            bottom = value
            break
    if bottom is None:
        raise SheetError("align", "找不到累积分区底线")

    rows = [bottom]
    hits = 1
    local = pitch
    for _ in range(ROWS):
        expected = rows[-1] - local
        snapped = near(expected, local * 0.3)
        if snapped is not None:
            gap = rows[-1] - snapped
            if pitch * 0.8 < gap < pitch * 1.2:
                local = local * 0.7 + gap * 0.3
            rows.append(snapped)
            hits += 1
        else:
            rows.append(expected)
    rows.reverse()
    return rows, hits


def locate_grid(warped, layout):
    gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    horizontal, vertical = line_masks(binary_ink(gray), 40)
    columns, column_hits = locate_columns(vertical, layout["scoreColumns"] if layout else None)
    reference_pitch = (
        (layout["scoreRows"][-1] - layout["scoreRows"][0]) / ROWS if layout else (columns[-1] - columns[0]) / SCORE_COLUMNS * 0.85
    )
    rows, row_hits = locate_rows(horizontal, columns, reference_pitch)
    quality = (row_hits / (ROWS + 1) + column_hits / (SCORE_COLUMNS + 1)) / 2
    return rows, columns, quality


def aligned_sheet(image, corners_arg):
    if corners_arg:
        values = [float(value) for value in corners_arg.split(",")]
        if len(values) != 8:
            raise SheetError("corners", "四个角坐标格式不对")
        corners = order_corners(values)
    else:
        corners = find_form_corners(image)
        if corners is None:
            raise SheetError("align", "找不到表格外框，请把四个角都拍进去，或手动点四个角")
    return warp(image, corners)


def calibrate(source, output, blank_output=None):
    warped = aligned_sheet(read_image(source), None)
    rows, columns, quality = locate_grid(warped, None)
    pitch = (rows[-1] - rows[0]) / ROWS
    layout = {
        "canvas": [CANVAS_W, CANVAS_H],
        "scoreColumns": [round(value, 1) for value in columns],
        "scoreRows": [round(value, 1) for value in rows],
        "final": [
            round(columns[0], 1),
            round(rows[-1] + pitch * 0.2, 1),
            round(columns[-1], 1),
            round(min(CANVAS_H, rows[-1] + pitch * 11), 1),
        ],
    }
    os.makedirs(os.path.dirname(os.path.abspath(output)), exist_ok=True)
    with open(output, "w", encoding="utf-8") as file:
        json.dump(layout, file, ensure_ascii=False, indent=2)
    if blank_output:
        cv2.imwrite(blank_output, warped, [cv2.IMWRITE_JPEG_QUALITY, 85])
    emit({"ok": True, "quality": round(quality, 2), "layout": layout})


def ink_map(warped):
    """去掉表格线之后的笔迹掩码。"""
    gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    binary = binary_ink(gray)
    horizontal, vertical = line_masks(binary, 60)
    lines = cv2.dilate(cv2.bitwise_or(horizontal, vertical), np.ones((5, 5), np.uint8))
    ink = cv2.bitwise_and(binary, cv2.bitwise_not(lines))
    return cv2.morphologyEx(ink, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))


def ink_score(ink, top, bottom, left, right):
    height = bottom - top
    width = right - left
    inner = ink[int(top + height * 0.15) : int(bottom - height * 0.15), int(left + width * 0.12) : int(right - width * 0.12)]
    return float(inner.mean() / 255) if inner.size else 0.0


def extract(source, output_dir, corners_arg=None, layout_path=None):
    with open(layout_path or DEFAULT_LAYOUT, encoding="utf-8") as file:
        layout = json.load(file)
    warped = aligned_sheet(read_image(source), corners_arg)
    rows, columns, quality = locate_grid(warped, layout)
    if quality < 0.6 and not corners_arg:
        raise SheetError("align", "表格没对齐，请正对表格、四个角拍全后重拍，或手动点四个角")

    os.makedirs(output_dir, exist_ok=True)
    cv2.imwrite(os.path.join(output_dir, "aligned.jpg"), warped, [cv2.IMWRITE_JPEG_QUALITY, 85])

    ink = ink_map(warped)
    cells = []
    for block in range(BLOCKS):
        for side, jersey_column in (("A", block * 4), ("B", block * 4 + 3)):
            left, right = columns[jersey_column], columns[jersey_column + 1]
            view_left = columns[block * 4] if side == "A" else columns[block * 4 + 2]
            view_right = columns[block * 4 + 2] if side == "A" else columns[block * 4 + 4]
            for row in range(ROWS):
                top, bottom = rows[row], rows[row + 1]
                score = ink_score(ink, top, bottom, left, right)
                if os.environ.get("FIBA_DEBUG"):
                    sys.stderr.write(f"{side}{block * ROWS + row + 1} {score:.3f}\n")
                if score < INK_THRESHOLD:
                    continue
                total = block * ROWS + row + 1
                margin = (bottom - top) * 0.55
                view = warped[
                    max(0, int(top - margin)) : min(CANVAS_H, int(bottom + margin)),
                    max(0, int(view_left)) : min(CANVAS_W, int(view_right)),
                ]
                name = f"score-{side}-{total:03d}.jpg"
                cv2.imwrite(os.path.join(output_dir, name), view, [cv2.IMWRITE_JPEG_QUALITY, 90])
                cells.append({"side": side, "total": total, "image": name, "ink": round(score, 3)})

    pitch = (rows[-1] - rows[0]) / ROWS
    final = warped[
        int(rows[-1] + pitch * 0.2) : int(min(CANVAS_H, rows[-1] + pitch * 11)),
        int(columns[0]) : int(columns[-1]),
    ]
    cv2.imwrite(os.path.join(output_dir, "final.jpg"), final, [cv2.IMWRITE_JPEG_QUALITY, 85])

    cells.sort(key=lambda cell: (cell["side"], cell["total"]))
    emit({"ok": True, "quality": round(quality, 2), "aligned": "aligned.jpg", "final": "final.jpg", "score": cells})


def option(rest, name):
    for index, value in enumerate(rest):
        if value == name and index + 1 < len(rest):
            return rest[index + 1]
    return None


def main(argv):
    try:
        if len(argv) >= 4 and argv[1] == "calibrate":
            calibrate(argv[2], argv[3], argv[4] if len(argv) > 4 else None)
        elif len(argv) >= 4 and argv[1] == "extract":
            extract(argv[2], argv[3], option(argv[4:], "--corners"), option(argv[4:], "--layout"))
        else:
            raise SheetError("usage", __doc__.strip())
    except SheetError as error:
        emit({"ok": False, "reason": error.reason, "message": error.message})


if __name__ == "__main__":
    main(sys.argv)

"""FIBA 记录表切格工具。

extract <照片> <输出目录> [--corners x1,y1,x2,y2,x3,y3,x4,y4] [--read] [--tiles]
    拉正照片，直接在照片上找累积分区格线，切出写了字的号码格，结果 JSON 输出到 stdout。
    加 --read 时用 PaddleOCR 认每格的手写号码，每格给出几种裁法的识别文字和置信度。
    加 --tiles 时把每队的号码格拼成带编号的大图，给看图大模型认号码。
    设置 FIBA_DEBUG=1 时把每格笔迹量打到 stderr，并在输出目录画 grid.jpg。
"""

import json
import os
import sys

import cv2
import numpy as np

CANVAS_W = 2000
CANVAS_H = 2830
MARGIN = 0.03
ROWS = 40
BLOCKS = 4
SCORE_COLUMNS = BLOCKS * 4
INK_THRESHOLD = 0.02


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


def form_corner_candidates(image):
    """表格最外圈的框：横竖线叠加后面积最大的轮廓。
    斜着拍时竖线短而歪，一组参数容易漏线连不成框，所以换几组线长和加粗程度各找一次，交给切格结果挑。"""
    height, width = image.shape[:2]
    scale = min(1.0, 1600 / max(height, width))
    small = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1 else image
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    binary = binary_ink(gray)
    image_area = gray.shape[0] * gray.shape[1]
    candidates = []
    for line_scale in (25, 50, 80):
        horizontal, vertical = line_masks(binary, line_scale)
        for thicken in (5, 11):
            grid = cv2.dilate(cv2.bitwise_or(horizontal, vertical), np.ones((thicken, thicken), np.uint8))
            contours, _ = cv2.findContours(grid, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                continue
            contour = max(contours, key=cv2.contourArea)
            if not image_area * 0.15 <= cv2.contourArea(contour) <= image_area * 0.95:
                continue
            hull = cv2.convexHull(contour)
            approx = cv2.approxPolyDP(hull, 0.02 * cv2.arcLength(hull, True), True)
            if len(approx) != 4:
                approx = cv2.boxPoints(cv2.minAreaRect(hull)).reshape(-1, 1, 2)
            corners = order_corners(approx.reshape(4, 2) / scale)
            if not any(np.abs(corners - other).max() < 10 for other in candidates):
                candidates.append(corners)
    return candidates


def warp(image, corners):
    """四个角映射到画布内缩一圈的位置，角点稍微点偏了，框外的格线也还留在画布里。"""
    mx, my = CANVAS_W * MARGIN, CANVAS_H * MARGIN
    target = np.array(
        [[mx, my], [CANVAS_W - 1 - mx, my], [CANVAS_W - 1 - mx, CANVAS_H - 1 - my], [mx, CANVAS_H - 1 - my]],
        dtype=np.float32,
    )
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


def snap_columns(found, left, right):
    step = (right - left) / SCORE_COLUMNS
    snapped = []
    for index in range(SCORE_COLUMNS + 1):
        expected = left + step * index
        near = [line for line in found if abs(line[0] - expected) <= step * 0.2]
        snapped.append(min(near, key=lambda line: abs(line[0] - expected)) if near else None)
    return snapped


def locate_columns(vertical):
    """累积分区是 16 列近似等宽的格子：在表格右侧找竖线，挑出对上的竖线总长最长的等距 17 条。"""
    start = int(CANVAS_W * 0.4)
    profile = vertical[:, start:].sum(axis=0) / 255
    found = [(start + x, float(profile[max(0, int(x) - 3) : int(x) + 4].max())) for x in peaks(profile, CANVAS_H * 0.06, 12)]
    candidates = [x for x, _ in found] + [CANVAS_W - 1.0]
    best = None
    for index, left in enumerate(candidates):
        for right in candidates[index + 1 :]:
            step = (right - left) / SCORE_COLUMNS
            if not CANVAS_W * 0.02 <= step <= CANVAS_W * 0.045:
                continue
            snapped = snap_columns(found, left, right)
            strength = sum(line[1] for line in snapped if line is not None)
            if best is None or strength > best[0]:
                best = (strength, snapped)
    snapped = [line[0] if line is not None else None for line in best[1]] if best else []
    if sum(value is not None for value in snapped) < SCORE_COLUMNS // 2:
        raise SheetError("align", "找不到累积分区的竖线")
    known = [(i, value) for i, value in enumerate(snapped) if value is not None]
    slope, intercept = np.polyfit([i for i, _ in known], [value for _, value in known], 1)
    columns = [value if value is not None else float(intercept + slope * i) for i, value in enumerate(snapped)]
    return columns, len(known)


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
    hits = [True]
    local = pitch
    for _ in range(ROWS + 4):
        expected = rows[-1] - local
        if expected < 0:
            break
        snapped = near(expected, local * 0.3)
        if snapped is not None:
            gap = rows[-1] - snapped
            if pitch * 0.8 < gap < pitch * 1.2:
                local = local * 0.7 + gap * 0.3
            rows.append(snapped)
        else:
            rows.append(expected)
        hits.append(snapped is not None)
    rows.reverse()
    hits.reverse()
    for _ in range(2):
        expected = rows[-1] + pitch
        if expected - pitch * 0.5 >= CANVAS_H:
            break
        snapped = near(expected, pitch * 0.3)
        rows.append(snapped if snapped is not None else expected)
        hits.append(snapped is not None)
    if len(rows) < ROWS + 1:
        raise SheetError("align", "累积分区的行数不够，表格可能没拍全")
    return rows, hits


def printed_rows(ink, rows, columns):
    """每行 8 个累计分格里有几个有字。累计分格都印着数字，表头那行只有 A/B 字母。"""
    counts = []
    for top, bottom in zip(rows, rows[1:]):
        filled = 0
        for block in range(BLOCKS):
            for column in (block * 4 + 1, block * 4 + 2):
                filled += ink_score(ink, top, bottom, columns[column], columns[column + 1]) >= INK_THRESHOLD
        counts.append(filled)
    return counts


def locate_grid(warped, ink):
    gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    horizontal, vertical = line_masks(binary_ink(gray), 40)
    columns, column_hits = locate_columns(vertical)
    lines, hits = locate_rows(horizontal, columns, (columns[-1] - columns[0]) / SCORE_COLUMNS * 0.85)
    counts = printed_rows(ink, lines, columns)
    start = max(range(len(lines) - ROWS), key=lambda index: (sum(counts[index : index + ROWS]), index))
    rows = lines[start : start + ROWS + 1]
    row_hits = sum(hits[start : start + ROWS + 1])
    quality = (row_hits / (ROWS + 1) + column_hits / (SCORE_COLUMNS + 1)) / 2
    return rows, columns, quality


def aligned_grid(image, corners_arg):
    """拉正并定格。手点了角就用手点的；否则每个候选外框都试切一遍，取格线对得最齐的。"""
    if corners_arg:
        values = [float(value) for value in corners_arg.split(",")]
        if len(values) != 8:
            raise SheetError("corners", "四个角坐标格式不对")
        candidates = [order_corners(values)]
    else:
        candidates = form_corner_candidates(image)
        if not candidates:
            raise SheetError("align", "找不到表格外框，请把四个角都拍进去，或手动点四个角")
    best = None
    error = None
    for corners in candidates:
        warped = warp(image, corners)
        ink = ink_map(warped)
        try:
            rows, columns, quality = locate_grid(warped, ink)
        except SheetError as failure:
            error = failure
            continue
        if best is None or quality > best[4]:
            best = (warped, ink, rows, columns, quality)
        if quality >= 0.95:
            break
    if best is None:
        raise error
    return best


def draw_grid(warped, rows, columns, path):
    overlay = warped.copy()
    for x in columns:
        cv2.line(overlay, (int(x), int(rows[0])), (int(x), int(rows[-1])), (255, 120, 0), 3)
    for y in rows:
        cv2.line(overlay, (int(columns[0]), int(y)), (int(columns[-1]), int(y)), (0, 160, 255), 2)
    cv2.imwrite(path, overlay, [cv2.IMWRITE_JPEG_QUALITY, 80])


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


def jersey_crops(warped, ink, top, bottom, left, right):
    """号码常写出格，除了格内原图，再给一张放宽、去掉格线的笔迹图。"""
    height, width = bottom - top, right - left
    tight = warped[int(top + height * 0.1) : int(bottom - height * 0.1), int(left + 4) : int(right - 4)]
    t, b = int(max(0, top - height * 0.3)), int(min(CANVAS_H, bottom + height * 0.1))
    l, r = int(max(0, left - width * 0.3)), int(min(CANVAS_W, right + width * 0.3))
    wide = cv2.cvtColor(255 - ink[t:b, l:r], cv2.COLOR_GRAY2BGR)
    pad = lambda image: cv2.copyMakeBorder(image, 12, 12, 24, 24, cv2.BORDER_CONSTANT, value=(255, 255, 255))
    return [pad(tight), pad(wide)]


TILES_PER_SHEET = 24
TILE_COLUMNS = 6


def context_tile(warped, rows, columns, row, column, label):
    """号码格连同左右半格、上下半行一起裁出来，蓝框标出目标格，左上角写编号，给看图大模型用。"""
    top, bottom = rows[row], rows[row + 1]
    height = bottom - top
    width = columns[column + 1] - columns[column]
    left, right = columns[column] - width * 0.6, columns[column + 1] + width * 0.6
    t, b = int(max(0, top - height * 0.6)), int(min(CANVAS_H, bottom + height * 0.6))
    l, r = int(max(0, left)), int(min(CANVAS_W, right))
    piece = warped[t:b, l:r].copy()
    box = (int(columns[column] - l), int(top - t), int(columns[column + 1] - l), int(bottom - t))
    cv2.rectangle(piece, box[:2], box[2:], (255, 0, 0), 2)
    piece = cv2.resize(piece, (180, 150), interpolation=cv2.INTER_CUBIC)
    tile = cv2.copyMakeBorder(piece, 30, 6, 6, 6, cv2.BORDER_CONSTANT, value=(255, 255, 255))
    cv2.putText(tile, f"#{label}", (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 200), 2)
    return tile


def write_tile_sheets(warped, rows, columns, cells, output_dir):
    """每队的号码格每 24 个拼成一张图，返回每张图对应的累计分。"""
    sheets = []
    for side in ("A", "B"):
        own = [cell for cell in cells if cell["side"] == side]
        for start in range(0, len(own), TILES_PER_SHEET):
            chunk = own[start : start + TILES_PER_SHEET]
            tiles = []
            for index, cell in enumerate(chunk):
                block, row = divmod(cell["total"] - 1, ROWS)
                column = block * 4 + (0 if side == "A" else 3)
                tiles.append(context_tile(warped, rows, columns, row, column, index + 1))
            blank = np.full_like(tiles[0], 255)
            tiles += [blank] * (-len(tiles) % TILE_COLUMNS)
            grid = np.vstack(
                [np.hstack(tiles[i : i + TILE_COLUMNS]) for i in range(0, len(tiles), TILE_COLUMNS)]
            )
            name = f"tiles-{side}-{start // TILES_PER_SHEET + 1}.jpg"
            cv2.imwrite(os.path.join(output_dir, name), grid, [cv2.IMWRITE_JPEG_QUALITY, 90])
            sheets.append({"image": name, "side": side, "totals": [cell["total"] for cell in chunk]})
    return sheets


def read_jerseys(crops):
    os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
    try:
        from paddleocr import TextRecognition
    except ImportError as error:
        raise SheetError("read", f"没装 PaddleOCR，认不了号码：{error}")
    model = TextRecognition(model_name=os.environ.get("FIBA_OCR_MODEL", "PP-OCRv5_server_rec"))
    images = [image for pair in crops for image in pair]
    results = list(model.predict(images, batch_size=32)) if images else []
    reads = []
    for index in range(len(crops)):
        pair = results[index * 2 : index * 2 + 2]
        reads.append([[str(item["rec_text"]), round(float(item["rec_score"]), 3)] for item in pair])
    return reads


def extract(source, output_dir, corners_arg=None, read=False, tiles=False):
    warped, ink, rows, columns, quality = aligned_grid(read_image(source), corners_arg)
    if quality < 0.6 and not corners_arg:
        raise SheetError("align", "表格没对齐，请正对表格、四个角拍全后重拍，或手动点四个角")

    os.makedirs(output_dir, exist_ok=True)
    cv2.imwrite(os.path.join(output_dir, "aligned.jpg"), warped, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if os.environ.get("FIBA_DEBUG"):
        draw_grid(warped, rows, columns, os.path.join(output_dir, "grid.jpg"))

    cells = []
    crops = []
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
                if read:
                    crops.append(jersey_crops(warped, ink, top, bottom, left, right))

    read_error = None
    if read:
        try:
            for cell, reads in zip(cells, read_jerseys(crops)):
                cell["reads"] = reads
        except SheetError as error:
            read_error = error.message

    pitch = (rows[-1] - rows[0]) / ROWS
    final = warped[
        int(rows[-1] + pitch * 0.2) : int(min(CANVAS_H, rows[-1] + pitch * 11)),
        int(columns[0]) : int(columns[-1]),
    ]
    cv2.imwrite(os.path.join(output_dir, "final.jpg"), final, [cv2.IMWRITE_JPEG_QUALITY, 85])

    cells.sort(key=lambda cell: (cell["side"], cell["total"]))
    payload = {"ok": True, "quality": round(quality, 2), "aligned": "aligned.jpg", "final": "final.jpg", "score": cells}
    if read_error:
        payload["readError"] = read_error
    if tiles and cells:
        payload["tiles"] = write_tile_sheets(warped, rows, columns, cells, output_dir)
    emit(payload)


def option(rest, name):
    for index, value in enumerate(rest):
        if value == name and index + 1 < len(rest):
            return rest[index + 1]
    return None


def main(argv):
    try:
        if len(argv) >= 4 and argv[1] == "extract":
            extract(argv[2], argv[3], option(argv[4:], "--corners"), "--read" in argv[4:], "--tiles" in argv[4:])
        else:
            raise SheetError("usage", __doc__.strip())
    except SheetError as error:
        emit({"ok": False, "reason": error.reason, "message": error.message})


if __name__ == "__main__":
    main(sys.argv)

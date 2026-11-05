import { Link } from 'react-router';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="text-6xl font-bold tracking-tighter text-slate-200">404</p>
      <h1 className="mt-5 text-xl font-bold text-navy-950">页面不存在</h1>
      <p className="mt-2 text-sm text-slate-500">你访问的页面可能已被移动或删除。</p>
      <Link to="/" className="btn-primary mt-6 inline-flex">
        返回首页
      </Link>
    </div>
  );
}

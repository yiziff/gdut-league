import { Link } from 'react-router';

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-5xl">🤔</p>
      <p className="mt-4 text-slate-500">页面不存在</p>
      <Link to="/" className="mt-4 inline-block text-gdut-600 hover:underline">
        返回首页
      </Link>
    </div>
  );
}

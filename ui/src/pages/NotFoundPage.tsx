import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 text-center space-y-4">
      <p className="text-6xl font-bold text-slate-700">404</p>
      <p className="text-xl text-slate-400">Page not found</p>
      <Link to="/dashboard" className="btn-primary">
        Back to Dashboard
      </Link>
    </div>
  )
}

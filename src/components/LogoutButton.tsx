'use client'

export default function LogoutButton() {
  async function logout() {
    await fetch('/api/customers/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <button className="btn btn-ghost" onClick={logout} type="button">
      退出登录
    </button>
  )
}

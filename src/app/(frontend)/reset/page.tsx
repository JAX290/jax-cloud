import ResetClient from '@/components/ResetClient'

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  return <ResetClient token={token || ''} />
}

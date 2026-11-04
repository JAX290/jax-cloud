import VerifyClient from '@/components/VerifyClient'

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  return <VerifyClient token={token || ''} />
}

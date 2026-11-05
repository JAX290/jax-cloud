import 'dotenv/config'

import { getPayload } from 'payload'

import config from './payload.config'

/**
 * 只同步数据库结构，不写入演示数据。
 * 用于生产环境更新：NODE_ENV=development 时 Payload 会执行 schema push。
 */
async function main() {
  await getPayload({ config })
  console.log('schema synced')
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

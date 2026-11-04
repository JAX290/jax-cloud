import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Cases } from './collections/Cases'
import { Customers } from './collections/Customers'
import { Media } from './collections/Media'
import { Services } from './collections/Services'
import { Tickets } from './collections/Tickets'
import { Users } from './collections/Users'
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const serverURL = process.env.SERVER_URL || 'http://localhost:3000'
const smtpPort = Number(process.env.SMTP_PORT || 1025)
const hasSMTPAuth = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: ' · JAX CLOUD',
    },
  },
  collections: [Users, Customers, Media, Services, Tickets, Cases],
  globals: [SiteSettings],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URL || 'file:./jax.db',
    },
  }),
  sharp,
  serverURL,
  cors: [serverURL],
  csrf: [serverURL],
  email: nodemailerAdapter({
    defaultFromAddress: process.env.EMAIL_FROM || 'no-reply@jax.markets',
    defaultFromName: process.env.EMAIL_FROM_NAME || 'JAX CLOUD',
    transportOptions: {
      host: process.env.SMTP_HOST || '127.0.0.1',
      port: smtpPort,
      secure: smtpPort === 465,
      ignoreTLS: smtpPort !== 465,
      ...(hasSMTPAuth
        ? {
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          }
        : {}),
    },
  }),
})

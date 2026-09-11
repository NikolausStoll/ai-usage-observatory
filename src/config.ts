import { z } from 'zod'

const RuntimeConfigSchema = z.object({
  port: z.coerce.number().int().min(1).max(65535).default(8096),
  dataDir: z.string().min(1).default('./data'),
  maxEventSizeBytes: z.coerce.number().int().positive().default(1_048_576),
  maxArtifactSizeBytes: z.coerce.number().int().positive().default(26_214_400),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
})

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>

export function loadRuntimeConfig(): RuntimeConfig {
  const result = RuntimeConfigSchema.safeParse({
    port: process.env['PORT'],
    dataDir: process.env['DATA_DIR'],
    maxEventSizeBytes: process.env['MAX_EVENT_SIZE_BYTES'],
    maxArtifactSizeBytes: process.env['MAX_ARTIFACT_SIZE_BYTES'],
    nodeEnv: process.env['NODE_ENV'],
  })
  if (!result.success) {
    console.error(JSON.stringify({
      level: 'error',
      msg: 'Invalid runtime configuration',
      errors: result.error.flatten(),
    }))
    process.exit(1)
  }
  return result.data
}

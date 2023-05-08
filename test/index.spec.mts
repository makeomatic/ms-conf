import { fileURLToPath } from 'node:url'
import { Store } from 'ms-conf'
import { loadTests } from './prepare-tests.js'

loadTests(Store, fileURLToPath(new URL('.', import.meta.url)))

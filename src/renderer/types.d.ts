/// <reference types="vite/client" />
import type { Api } from '../preload/index'
declare global { interface Window { izlix: Api } }
export {}

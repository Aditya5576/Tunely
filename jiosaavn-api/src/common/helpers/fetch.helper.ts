import { userAgents, type Endpoints } from '#common/constants'
import type { ApiContextEnum } from '#common/enums'

type EndpointValue = (typeof Endpoints)[keyof typeof Endpoints]

interface FetchParams {
  endpoint: EndpointValue
  params: Record<string, string | number>
  context?: ApiContextEnum
}

interface FetchResponse<T> {
  data: T
  ok: Response['ok']
}

export const useFetch = async <T>({ endpoint, params, context }: FetchParams): Promise<FetchResponse<T>> => {
  const url = new URL('https://www.jiosaavn.com/api.php')

  url.searchParams.append('__call', endpoint.toString())
  url.searchParams.append('_format', 'json')
  url.searchParams.append('_marker', '0')
  url.searchParams.append('api_version', '4')
  url.searchParams.append('ctx', context || 'web6dot0')

  Object.keys(params).forEach((key) => url.searchParams.append(key, String(params[key])))

  const cacheKey = new Request(url.toString())
  const hasCache = typeof caches !== 'undefined' && (caches as any).default
  const cache = hasCache ? (caches as any).default : null

  // Try Cloudflare edge cache first
  if (cache) {
    const cached = await cache.match(cacheKey)
    if (cached) {
      const data = await cached.json()
      return { data: data as T, ok: true }
    }
  }

  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)]

  const response = await fetch(url.toString(), {
    headers: { 
      'Content-Type': 'application/json', 
      'User-Agent': randomUserAgent,
      'X-Forwarded-For': '103.241.136.1',
      'X-Real-IP': '103.241.136.1'
    }
  })

  const data = await response.json()

  if (response.ok) {
    // Cache: search results for 5 min, everything else 10 min
    const isSearch = endpoint.toString().includes('search') || endpoint.toString().includes('autocomplete')
    const ttl = isSearch ? 300 : 600
    const cacheResponse = new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}`,
      }
    })
    if (cache) {
      await cache.put(cacheKey, cacheResponse)
    }
  }

  return { data: data as T, ok: response.ok }
}

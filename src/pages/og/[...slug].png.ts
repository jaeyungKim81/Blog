import { getCollection } from 'astro:content'
import { ogImage } from '../../lib/og.js'
import { SITE_TITLE, SITE_DESCRIPTION } from '../../consts'

// 글마다 하나 + 사이트 공통 하나. 빌드 때 미리 만들어지므로 실행 중 비용이 없다.
export async function getStaticPaths() {
  const posts = await getCollection('blog')
  return [
    { params: { slug: 'site' }, props: { title: SITE_TITLE, sub: SITE_DESCRIPTION } },
    ...posts.map((p) => ({
      params: { slug: p.id },
      props: {
        title: p.data.title,
        category: p.data.category,
        date: p.data.pubDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }),
      },
    })),
  ]
}

export async function GET({ props }) {
  return new Response(await ogImage(props), { headers: { 'Content-Type': 'image/png' } })
}

import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';

const ONEMAP_URL = 'https://www.onemap.gov.sg/api/common/elastic/search';

export async function GET(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url = `${ONEMAP_URL}?searchVal=${encodeURIComponent(q.trim())}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    const data = await res.json();

    const results = (data.results || []).slice(0, 8).map(r => ({
      address: r.ADDRESS,
      blk: r.BLK_NO || '',
      road: r.ROAD_NAME || '',
      building: r.BUILDING !== 'NIL' ? r.BUILDING : '',
      postal: r.POSTAL !== 'NIL' ? r.POSTAL : '',
      lat: r.LATITUDE,
      lng: r.LONGITUDE,
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}

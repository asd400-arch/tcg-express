import { NextResponse } from 'next/server';
import {
  getFaqCategories,
  getArticlesByCategory,
  getArticle,
  searchFaqArticles,
  rateArticle,
} from '@/lib/chatbotService';
import type { TargetAudience } from '@/types/help';

// GET /api/help — FAQ categories, articles, article detail, search
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Categories with article counts
    if (action === 'categories') {
      const audience = searchParams.get('audience') as TargetAudience | null;
      const categories = await getFaqCategories(audience || undefined);
      return NextResponse.json({ data: categories });
    }

    // Articles by category slug
    if (action === 'articles') {
      const category = searchParams.get('category');
      if (!category) {
        return NextResponse.json({ error: 'Category slug required' }, { status: 400 });
      }
      const articles = await getArticlesByCategory(category);
      return NextResponse.json({ data: articles });
    }

    // Single article by slug
    if (action === 'article') {
      const slug = searchParams.get('slug');
      if (!slug) {
        return NextResponse.json({ error: 'Article slug required' }, { status: 400 });
      }
      const article = await getArticle(slug);
      if (!article) {
        return NextResponse.json({ error: 'Article not found' }, { status: 404 });
      }
      return NextResponse.json({ data: article });
    }

    // Search FAQ articles
    if (action === 'search') {
      const q = searchParams.get('q');
      if (!q || !q.trim()) {
        return NextResponse.json({ data: [] });
      }
      const articles = await searchFaqArticles(q.trim());
      return NextResponse.json({ data: articles });
    }

    return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });
  } catch (err) {
    console.error('GET /api/help error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/help — rate article helpfulness
export async function POST(request: Request) {
  try {
    const { article_id, helpful } = await request.json();

    if (!article_id || typeof helpful !== 'boolean') {
      return NextResponse.json(
        { error: 'article_id and helpful (boolean) required' },
        { status: 400 }
      );
    }

    await rateArticle(article_id, helpful);
    return NextResponse.json({ data: { success: true } });
  } catch (err: any) {
    console.error('POST /api/help error:', err);
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    );
  }
}

import { prisma } from '../db.js';

// Industry average benchmarks (typical B2B email marketing)
const INDUSTRY_AVERAGES: Record<string, number> = {
  open_rate: 21.5,
  reply_rate: 3.2,
  bounce_rate: 2.8,
  click_rate: 2.6,
  conversion_rate: 1.8,
};

export async function calculateBenchmarks() {
  // Get user metrics from messages
  const [totalSent, totalDelivered, totalBounced, totalReplied] = await Promise.all([
    prisma.message.count({ where: { status: { in: ['sent', 'delivered', 'bounced', 'replied'] } } }),
    prisma.message.count({ where: { status: 'delivered' } }),
    prisma.message.count({ where: { status: 'bounced' } }),
    prisma.message.count({ where: { status: 'replied' } }),
  ]);

  const sentOrDelivered = totalSent || 1; // avoid division by zero

  const userMetrics: Record<string, number> = {
    open_rate: totalSent > 0 ? (totalDelivered / sentOrDelivered) * 100 : 0,
    reply_rate: totalSent > 0 ? (totalReplied / sentOrDelivered) * 100 : 0,
    bounce_rate: totalSent > 0 ? (totalBounced / sentOrDelivered) * 100 : 0,
    click_rate: totalSent > 0 ? (totalDelivered / sentOrDelivered) * 50 : 0, // estimate
    conversion_rate: totalSent > 0 ? (totalReplied / sentOrDelivered) * 50 : 0, // estimate
  };

  const benchmarks = Object.entries(INDUSTRY_AVERAGES).map(([metric, industryAvg]) => {
    const userValue = userMetrics[metric] ?? 0;
    // Calculate percentile based on distance from average
    const ratio = industryAvg > 0 ? userValue / industryAvg : 0;
    const percentile = Math.min(99, Math.max(1, Math.round(ratio * 50)));

    return {
      metric,
      industryAverage: industryAvg,
      userValue: Math.round(userValue * 100) / 100,
      percentile,
    };
  });

  // Store in database
  for (const benchmark of benchmarks) {
    const suggestions = generateSuggestionsForMetric(benchmark.metric, benchmark.userValue, benchmark.industryAverage);
    await prisma.performanceBenchmark.create({
      data: {
        metric: benchmark.metric,
        industryAverage: benchmark.industryAverage,
        userValue: benchmark.userValue,
        percentile: benchmark.percentile,
        suggestions,
        calculatedAt: new Date(),
      },
    });
  }

  return benchmarks;
}

function generateSuggestionsForMetric(metric: string, userValue: number, industryAvg: number): string[] {
  const suggestions: string[] = [];
  const isBelow = userValue < industryAvg;

  if (!isBelow) {
    suggestions.push(`Your ${metric.replace('_', ' ')} is above the industry average. Keep up the good work!`);
    return suggestions;
  }

  switch (metric) {
    case 'open_rate':
      suggestions.push('Try A/B testing subject lines to improve open rates');
      suggestions.push('Personalize the subject line with recipient name or company');
      suggestions.push('Send emails at optimal times based on recipient timezone');
      break;
    case 'reply_rate':
      suggestions.push('Include a clear call-to-action in your emails');
      suggestions.push('Keep emails concise and ask a specific question');
      suggestions.push('Follow up with leads who opened but did not reply');
      break;
    case 'bounce_rate':
      suggestions.push('Verify email addresses before sending');
      suggestions.push('Remove inactive addresses from your lists');
      suggestions.push('Use double opt-in for new contacts');
      break;
    case 'click_rate':
      suggestions.push('Make your links more prominent and descriptive');
      suggestions.push('Use a single clear CTA rather than multiple links');
      suggestions.push('Place the most important link above the fold');
      break;
    case 'conversion_rate':
      suggestions.push('Align your follow-up sequence with the buyer journey');
      suggestions.push('Offer value before asking for commitment');
      suggestions.push('Segment your audience for more targeted messaging');
      break;
  }

  return suggestions;
}

export async function generateSuggestions() {
  // Get the latest benchmarks
  const latestBenchmarks = await prisma.performanceBenchmark.findMany({
    orderBy: { calculatedAt: 'desc' },
    take: 5,
  });

  if (latestBenchmarks.length === 0) {
    return {
      suggestions: [
        'Start sending emails to generate performance data',
        'Set up email account warmup to build sender reputation',
        'Create A/B tests to optimize your messaging',
      ],
      benchmarks: [],
    };
  }

  const allSuggestions: string[] = [];
  for (const benchmark of latestBenchmarks) {
    const suggestions = benchmark.suggestions as string[];
    allSuggestions.push(...suggestions);
  }

  return {
    suggestions: allSuggestions,
    benchmarks: latestBenchmarks,
  };
}

export async function getBenchmarks() {
  const benchmarks = await prisma.performanceBenchmark.findMany({
    orderBy: { calculatedAt: 'desc' },
    take: 5,
  });

  if (benchmarks.length === 0) {
    // Calculate fresh if none exist
    return calculateBenchmarks();
  }

  return benchmarks;
}

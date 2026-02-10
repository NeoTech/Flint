import { describe, it, expect } from 'vitest';
import { SkillCards } from './skill-cards.js';

describe('SkillCards', () => {
  const defaultProps = {
    skills: [
      {
        name: 'add-content',
        icon: '📝',
        description: 'Create or edit content pages.',
        tags: ['frontmatter', ':::children'],
        color: 'green' as const,
      },
      {
        name: 'build-and-test',
        icon: '🧪',
        description: 'Build the site and run tests.',
        tags: ['vitest', 'npm run build'],
        color: 'amber' as const,
      },
    ],
  };

  it('should render all skill cards', () => {
    const html = SkillCards.render(defaultProps);
    expect(html).toContain('add-content');
    expect(html).toContain('build-and-test');
  });

  it('should render skill descriptions', () => {
    const html = SkillCards.render(defaultProps);
    expect(html).toContain('Create or edit content pages.');
    expect(html).toContain('Build the site and run tests.');
  });

  it('should render icons', () => {
    const html = SkillCards.render(defaultProps);
    expect(html).toContain('📝');
    expect(html).toContain('🧪');
  });

  it('should render tags as badges', () => {
    const html = SkillCards.render(defaultProps);
    expect(html).toContain('frontmatter');
    expect(html).toContain(':::children');
    expect(html).toContain('vitest');
  });

  it('should render color-coded tag badges', () => {
    const html = SkillCards.render(defaultProps);
    expect(html).toContain('bg-green-100');
    expect(html).toContain('text-green-800');
    expect(html).toContain('bg-amber-100');
    expect(html).toContain('text-amber-800');
  });

  it('should escape user-supplied strings', () => {
    const html = SkillCards.render({
      skills: [{
        name: '<script>xss</script>',
        icon: '📝',
        description: '<img onerror="hack">',
        tags: ['<b>bold</b>'],
        color: 'green' as const,
      }],
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img onerror');
    expect(html).not.toContain('<b>bold');
    expect(html).toContain('&lt;script&gt;');
  });

  it('should return empty string for empty skills array', () => {
    const html = SkillCards.render({ skills: [] });
    expect(html).toBe('');
  });

  it('should handle a skill with no tags', () => {
    const html = SkillCards.render({
      skills: [{
        name: 'test-skill',
        icon: '🔧',
        description: 'A skill.',
        tags: [],
        color: 'blue' as const,
      }],
    });
    expect(html).toContain('test-skill');
    expect(html).toContain('A skill.');
  });

  it('should apply full-width class to the last card when odd count', () => {
    const html = SkillCards.render({
      skills: [
        { name: 'a', icon: '1', description: 'd', tags: [], color: 'green' as const },
        { name: 'b', icon: '2', description: 'd', tags: [], color: 'blue' as const },
        { name: 'c', icon: '3', description: 'd', tags: [], color: 'purple' as const },
      ],
    });
    expect(html).toContain('sm:col-span-2');
  });
});

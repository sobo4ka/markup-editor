import { describe, it, expect } from 'vitest'
import { inlineFmt, parseMarkdown } from '../markdownUtils'

describe('inlineFmt', () => {
  it('escapes HTML special characters', () => {
    expect(inlineFmt('a & b')).toBe('a &amp; b')
    expect(inlineFmt('<script>')).toBe('&lt;script&gt;')
  })

  it('renders bold text', () => {
    expect(inlineFmt('**hello**')).toBe('<strong>hello</strong>')
  })

  it('renders italic text', () => {
    expect(inlineFmt('*hello*')).toBe('<em>hello</em>')
  })

  it('renders strikethrough', () => {
    expect(inlineFmt('~~hello~~')).toBe('<del>hello</del>')
  })

  it('renders inline code', () => {
    expect(inlineFmt('`code`')).toBe('<code>code</code>')
  })

  it('renders a link', () => {
    expect(inlineFmt('[click](https://example.com)')).toBe(
      '<a href="https://example.com" target="_blank">click</a>'
    )
  })

  it('renders an image', () => {
    expect(inlineFmt('![alt text](img.png)')).toBe(
      '<img alt="alt text" src="img.png" style="max-width:100%"/>'
    )
  })
})

describe('parseMarkdown', () => {
  it('renders a heading', () => {
    const result = parseMarkdown('# Hello')
    expect(result).toContain('<h1')
    expect(result).toContain('Hello')
  })

  it('renders h2 and h3', () => {
    expect(parseMarkdown('## Section')).toContain('<h2')
    expect(parseMarkdown('### Sub')).toContain('<h3')
  })

  it('renders a paragraph', () => {
    const result = parseMarkdown('Just some text')
    expect(result).toContain('<p')
    expect(result).toContain('Just some text')
  })

  it('renders a blockquote', () => {
    const result = parseMarkdown('> famous quote')
    expect(result).toContain('<blockquote')
    expect(result).toContain('famous quote')
  })

  it('renders a horizontal rule', () => {
    expect(parseMarkdown('---')).toContain('<hr')
  })

  it('renders a code block', () => {
    const result = parseMarkdown('```\nconst x = 1\n```')
    expect(result).toContain('<pre')
    expect(result).toContain('<code>')
    expect(result).toContain('const x = 1')
  })

  it('renders a table', () => {
    const result = parseMarkdown('| A | B |\n|---|---|\n| 1 | 2 |')
    expect(result).toContain('<table')
    expect(result).toContain('<th>')
    expect(result).toContain('<td>')
  })

  it('returns empty string for blank input', () => {
    expect(parseMarkdown('')).toBe('')
  })
})

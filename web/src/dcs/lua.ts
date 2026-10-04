import { parse, type Expression, type Node } from 'luaparse'

export type LuaValue = string | number | boolean | null | LuaValue[] | { [key: string]: LuaValue }

const toBytes = (text: string) => Array.from(new TextEncoder().encode(text), (b) => String.fromCharCode(b)).join('')
const fromBytes = (bytes: string) => new TextDecoder().decode(Uint8Array.from(bytes, (c) => c.charCodeAt(0)))

function value(node: Expression): LuaValue {
  switch (node.type) {
    case 'StringLiteral': return fromBytes(node.value ?? '')
    case 'NumericLiteral': return node.value
    case 'BooleanLiteral': return node.value
    case 'NilLiteral': return null
    case 'UnaryExpression':
      if (node.operator === '-' && node.argument.type === 'NumericLiteral') return -node.argument.value
      break
    case 'TableConstructorExpression': {
      const entries: [string | number, LuaValue][] = []
      let next = 1
      for (const field of node.fields) {
        if (field.type === 'TableKey') entries.push([value(field.key) as string | number, value(field.value)])
        else if (field.type === 'TableKeyString') entries.push([field.key.name, value(field.value)])
        else entries.push([next++, value(field.value)])
      }
      const sequence = entries.length > 0 && entries.every(([k], i) => k === i + 1)
      return sequence ? entries.map(([, v]) => v) : Object.fromEntries(entries)
    }
  }
  throw new Error(`Unsupported Lua value: ${node.type}`)
}

function firstTable(nodes: Node[]): Expression | null {
  for (const node of nodes) {
    if (node.type === 'LocalStatement' || node.type === 'AssignmentStatement') {
      const table = node.init.find((n) => n.type === 'TableConstructorExpression')
      if (table) return table
    }
    if (node.type === 'ReturnStatement') {
      const table = node.arguments.find((n) => n.type === 'TableConstructorExpression')
      if (table) return table
    }
  }
  return null
}

export function parseLua(text: string): LuaValue {
  const ast = parse(toBytes(text), { encodingMode: 'pseudo-latin1', comments: false })
  const table = firstTable(ast.body)
  if (!table) throw new Error('No Lua table found')
  return value(table)
}

const quote = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`

export function toLua(item: unknown, indent = ''): string {
  if (typeof item === 'boolean' || typeof item === 'number') return String(item)
  if (typeof item === 'string') return quote(item)
  if (item === null || item === undefined) return 'nil'
  const inner = `${indent}\t`
  const pairs: [string | number, unknown][] = Array.isArray(item)
    ? item.map((v, i) => [i + 1, v])
    : Object.keys(item).sort().map((k) => [k, (item as Record<string, unknown>)[k]])
  const body = pairs.map(([k, v]) => `${inner}[${typeof k === 'number' ? k : quote(k)}] = ${toLua(v, inner)},\n`).join('')
  return `{\n${body}${indent}}`
}

export const luaFile = (name: string, item: unknown) => `local ${name} = ${toLua(item)}\nreturn ${name}`

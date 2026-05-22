'use strict'

/**
 * Disallow catch blocks that swallow failures without reporting or rethrowing.
 * Allowed: throw, logError, logWarn, surfaceError, surfaceWarn, or eslint-disable comment.
 */

const REPORT_CALLS = new Set([
  'logError',
  'logWarn',
  'surfaceError',
  'surfaceWarn',
])

function calleeName(node) {
  if (!node || node.type !== 'CallExpression') return null
  const c = node.callee
  if (c.type === 'Identifier') return c.name
  if (c.type === 'MemberExpression' && c.property.type === 'Identifier' && !c.computed) {
    return c.property.name
  }
  return null
}

function callReports(node) {
  if (!node) return false
  if (node.type === 'CallExpression') return REPORT_CALLS.has(calleeName(node) ?? '')
  if (node.type === 'AwaitExpression') return callReports(node.argument)
  return false
}

function statementReports(stmt) {
  if (stmt.type === 'ThrowStatement') return true
  if (stmt.type === 'ExpressionStatement') return callReports(stmt.expression)
  if (stmt.type === 'ReturnStatement' && stmt.argument) return callReports(stmt.argument)
  return false
}

function blockReportsOrRethrows(block) {
  if (!block || block.type !== 'BlockStatement') return false
  return block.body.some(statementReports)
}

function isSilentCatch(catchNode, sourceCode) {
  const block = catchNode.body
  if (block.type !== 'BlockStatement') return false
  if (block.body.length === 0) return true

  const comments = sourceCode.getCommentsInside(catchNode)
  if (comments.some((c) => c.value.includes('eslint-disable') && c.value.includes('silent-catch'))) {
    return false
  }

  if (blockReportsOrRethrows(block)) return false

  const onlyConsoleAndReturn = block.body.every((stmt) => {
    if (stmt.type === 'ReturnStatement') return true
    if (stmt.type === 'ExpressionStatement' && stmt.expression.type === 'CallExpression') {
      const name = calleeName(stmt.expression)
      return name === 'console.error' || name === 'console.warn' || name === 'console.log'
    }
    return false
  })
  if (onlyConsoleAndReturn && block.body.length > 0) return true

  return block.body.length > 0
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Catch blocks must log via logError/surfaceError or rethrow; avoid silent null/[] returns.',
    },
    schema: [],
    messages: {
      silentCatch:
        'Silent catch — use logError (server) or surfaceError (client), or document with eslint-disable-next-line pem-i18n/no-silent-catch.',
    },
  },
  create(context) {
    const sourceCode = context.getSourceCode()
    return {
      CatchClause(node) {
        if (isSilentCatch(node, sourceCode)) {
          context.report({ node, messageId: 'silentCatch' })
        }
      },
    }
  },
}

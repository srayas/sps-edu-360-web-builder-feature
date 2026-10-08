import { BadRequestException, Injectable, NestMiddleware } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
// import { ResponseResource } from '../models/response-resource.model';
import { CustomLogger } from '../config/custom-logger'
import xss from 'xss'
import { RequestContext } from '../providers/request-context'

@Injectable()
export class ApiMiddleware implements NestMiddleware {
  private readonly logger = new CustomLogger({
    currentExecutor: ApiMiddleware.name,
  })
  constructor() {}
  private readonly forbiddenKeywords = [
    // SQL Injection Prevention
    'select',
    'create',
    'insert',
    'update',
    'delete',
    'drop',
    'union',
    'where',
    'or',
    '=',
    '==',
    '!=',
    '--',
    '/*',
    '*/',
    'id=-1',
    // XSS Prevention
    'eval',
    'alert',
    'document',
    '<script>',
    '</script>',
    'iframe',
    'javascript:',
    'onerror',
    'onload',
    // Command Injection Prevention
    'cmd',
    'wget',
    'sleep',
  ]

  use(req: any, res: any, next: () => void) {
    const rid = req.headers['rid'] || uuidv4()
    const ipAddress =
      req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']
    const userAgent = req.headers['user-agent']
    const apiPath = req.originalUrl

    const url = req.url
    const body = req.body
    const params = req.query
    this.validateRequestData(url)
    this.sanitizeRequestData(url)
    this.sanitizeRequestData(params)
    this.validateRequestData(params)
    RequestContext.run({ rid, apiPath, ipAddress, userAgent }, () => {
      const originalJson = res.json
      res.json = (body: any) => {
        if (
          body &&
          typeof body === 'object' &&
          (!body.ticketId || (body.ticketId && body.ticketId == ''))
        ) {
          body.ticketId = rid
        }
        originalJson.call(res, body)
      }
      next()
    })
  }

  private sanitizeRequestData(body: any): void {
    const sanitize = (obj: any): any => {
      if (typeof obj === 'string') {
        return xss(obj)
      }

      if (Array.isArray(obj)) {
        return obj.map((item) => sanitize(item))
      }

      if (typeof obj === 'object' && obj !== null) {
        for (let key in obj) {
          if (obj.hasOwnProperty(key)) {
            key = sanitize(key)
            obj[key] = sanitize(obj[key])
          }
        }
      }

      return obj
    }
    sanitize(body)
  }

  private validateRequestData(body: any): void {
    const checkForForbiddenKeywords = (obj: any) => {
      if (typeof obj === 'string') {
        this.checkForKeywordsInString(obj)
      }

      if (Array.isArray(obj)) {
        obj.forEach((item) => checkForForbiddenKeywords(item))
      }

      if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            checkForForbiddenKeywords(key)
            checkForForbiddenKeywords(obj[key])
          }
        }
      }
    }
    checkForForbiddenKeywords(body)
  }

  private checkForKeywordsInString(input: string): void {
    const lowerCaseInput = input.toLowerCase()
    for (const keyword of this.forbiddenKeywords) {
      if (lowerCaseInput.includes(keyword)) {
        this.logger.error(`Input contains forbidden keyword: ${keyword}`)
        throw new BadRequestException(
          `Input contains forbidden keyword: ${keyword}`,
        )
      }
    }
  }
}

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
} from '@nestjs/common'
import { Observable, throwError, of } from 'rxjs'
import { catchError, map } from 'rxjs/operators'
import { Response } from '@spsedu360/common-app-lib'
import { v4 as uuidv4 } from 'uuid'
import { CustomLogger } from '../config'
import { RequestContext } from '../providers'

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  private readonly logger = new CustomLogger({
    currentExecutor: ResponseInterceptor.name,
  })
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest()
    const rid = request.headers['rid'] || RequestContext.get()?.rid
    return next.handle().pipe(
      map((data) => ({
        ticketId: rid,
        data,
        status: context.switchToHttp().getResponse().statusCode,
        message: 'Success',
      })),
      catchError((error) => {
        const status = error instanceof HttpException ? error.getStatus() : 500

        return of({
          ticketId: rid,
          data: error.response || null,
          status,
          message: 'Failed',
        })
      }),
    )
  }
}

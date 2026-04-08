import { ResponseTransformInterceptor } from './response-transform.interceptor';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

describe('ResponseTransformInterceptor', () => {
  let interceptor: ResponseTransformInterceptor<unknown>;

  const createMockExecutionContext = (): ExecutionContext =>
    ({} as ExecutionContext);

  const createCallHandler = (data: unknown): CallHandler => ({
    handle: () => of(data),
  });

  beforeEach(() => {
    interceptor = new ResponseTransformInterceptor();
  });

  it('should wrap plain data in { success, data } format', (done) => {
    const result = interceptor.intercept(
      createMockExecutionContext(),
      createCallHandler({ name: 'test' }),
    );

    result.subscribe((value) => {
      expect(value).toEqual({
        success: true,
        data: { name: 'test' },
      });
      done();
    });
  });

  it('should not double-wrap if response already has success field', (done) => {
    const alreadyWrapped = { success: true, data: { id: 1 }, message: 'ok' };

    const result = interceptor.intercept(
      createMockExecutionContext(),
      createCallHandler(alreadyWrapped),
    );

    result.subscribe((value) => {
      expect(value).toBe(alreadyWrapped);
      done();
    });
  });

  it('should extract meta from data and place it at top level', (done) => {
    const dataWithMeta = {
      items: [1, 2, 3],
      meta: { page: 1, perPage: 20, total: 3, totalPages: 1 },
    };

    const result = interceptor.intercept(
      createMockExecutionContext(),
      createCallHandler(dataWithMeta),
    );

    result.subscribe((value) => {
      expect(value.success).toBe(true);
      expect(value.meta).toEqual({ page: 1, perPage: 20, total: 3, totalPages: 1 });
      done();
    });
  });

  it('should handle null data', (done) => {
    const result = interceptor.intercept(
      createMockExecutionContext(),
      createCallHandler(null),
    );

    result.subscribe((value) => {
      expect(value).toEqual({ success: true, data: null });
      done();
    });
  });

  it('should handle array data', (done) => {
    const result = interceptor.intercept(
      createMockExecutionContext(),
      createCallHandler([1, 2, 3]),
    );

    result.subscribe((value) => {
      expect(value).toEqual({ success: true, data: [1, 2, 3] });
      done();
    });
  });
});

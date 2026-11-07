import { Request, Response, NextFunction } from "express";
import { ZodTypeAny } from "zod";

export interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    void (async () => {
      try {
        if (schemas.params) {
          const result = await schemas.params.safeParseAsync(req.params);
          if (!result.success) {
            return next(result.error);
          }
          req.params = result.data as Record<string, string>;
        }

        if (schemas.query) {
          const result = await schemas.query.safeParseAsync(req.query);
          if (!result.success) {
            return next(result.error);
          }
          req.query = result.data as Record<string, string>;
        }

        if (schemas.body) {
          const result = await schemas.body.safeParseAsync(req.body);
          if (!result.success) {
            return next(result.error);
          }
          req.body = result.data as Record<string, unknown>;
        }

        return next();
      } catch (err) {
        return next(err);
      }
    })();
  };
}

export function validateBody(schema: ZodTypeAny) {
  return validate({ body: schema });
}

export function validateQuery(schema: ZodTypeAny) {
  return validate({ query: schema });
}

export function validateParams(schema: ZodTypeAny) {
  return validate({ params: schema });
}

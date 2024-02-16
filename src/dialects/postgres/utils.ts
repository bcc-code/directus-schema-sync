import type { DiffModifierContextType, SchemaModifierContextType } from '../../types.js';

export async function ProcessNextvalDefaultValues<T extends DiffModifierContextType>(context: T): Promise<T> {
	if (context.diff) {
        context.diff.fields = await Promise.all(context.diff.fields
            .map( async (field) => {
                let indexesToDelete: number[] = [];
                await Promise.all(field.diff.map( async (diff, i) => {
                    if (
                        diff.kind === 'E' &&
                        diff.path &&
                        diff.path[0] === 'schema' &&
                        diff.path[1] === 'default_value' &&
                        diff.rhs === `nextval('${field.collection}_${field.field}_seq'::regclass)`
                    ) {
                        indexesToDelete.push(i);
                        await context.svc.knex.transaction(function(trx: any) {
                            return trx.raw("ALTER TABLE IF EXISTS public.?? ALTER COLUMN ?? SET DEFAULT " + diff.rhs, [field.collection, field.field]);
                        });
                    }
                    if (
                        diff.kind === 'N' &&
                        diff.rhs?.schema?.data_type === 'integer' &&
                        typeof diff.rhs.schema.default_value === 'string' &&
                        diff.rhs.schema.default_value.startsWith('nextval')
                    ) diff.rhs.schema.default_value = context.svc.knex.raw(diff.rhs.schema.default_value);
                    return diff;
                }));
                indexesToDelete.forEach( i => field.diff.splice(i,1) );
                return field;
            }));
    }
	return context;
}

export function CorrectHasAutoIncrement<T extends SchemaModifierContextType>(context: T): T {
	context.snapshot.fields
        .map( (field: any) => {
            if (field.schema?.has_auto_increment === false && field.schema.default_value=="nextval('"+field.schema.table+"_"+field.schema.name+"_seq'::regclass)") {
                field.schema.has_auto_increment = true;
            }
            return field;
        }) as T;
	return context;
}
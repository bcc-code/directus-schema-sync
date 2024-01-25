export function sequenceToSerialType<T extends Record<string, any>>(snapshot: T): T {
	snapshot.fields
        .map( (field: any) => {
            if (field.schema?.default_value=="nextval('"+field.schema?.table+"_"+field.schema?.name+"_seq'::regclass)") {
                field.schema.default_value = null;
                field.schema.has_auto_increment = true;
            }
            return field;
        }) as T;
	return snapshot;
}
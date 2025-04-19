export const sanitizeNullableString = (value: string | null | undefined): string | undefined => {
    return typeof value === 'string' ? value : undefined;
  };
  
const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

export function compareNatural(left: string, right: string) {
  return naturalCollator.compare(left, right);
}

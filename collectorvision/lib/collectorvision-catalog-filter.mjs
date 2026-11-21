export function filterCatalog(catalog, allowedCardIds) {
  const allowed = new Set(allowedCardIds);
  const indices = [];
  for (let row = 0; row < catalog.rows; row += 1) {
    if (allowed.has(catalog.cardIds[row])) indices.push(row);
  }
  if (indices.length === 0) {
    throw new Error("No cards from the requested sets are available in the selected catalog");
  }

  const embeddings = new Uint16Array(indices.length * catalog.dims);
  for (let index = 0; index < indices.length; index += 1) {
    const offset = indices[index] * catalog.dims;
    embeddings.set(catalog.embeddings.subarray(offset, offset + catalog.dims), index * catalog.dims);
  }
  return {
    ...catalog,
    embeddings,
    cardIds: indices.map((index) => catalog.cardIds[index]),
    cardNames: catalog.cardNames?.length ? indices.map((index) => catalog.cardNames[index]) : null,
    secondaryIds: catalog.secondaryIds?.length ? indices.map((index) => catalog.secondaryIds[index]) : null,
    rows: indices.length,
  };
}

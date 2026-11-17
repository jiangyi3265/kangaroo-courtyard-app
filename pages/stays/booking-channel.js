export function isAssistedStay(stay = {}) {
  if (stay.houseType) return stay.houseType === 'direct'
  return (stay.operateMode || stay.opType) === 'direct'
}

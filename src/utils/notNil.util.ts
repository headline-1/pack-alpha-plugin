export const isTruthy = <T>(value: T): value is Exclude<T, undefined | false | '' | null | 0> => !!value;

type TruthyObject<T> = { [K in keyof T]: Exclude<T[K], undefined | false | '' | null | 0> };

export const removeNonTruthyValues = <T extends object>(object: T): TruthyObject<T> => {
  for(const key in object){
    if(object.hasOwnProperty(key) && !isTruthy(object[key])){
      delete object[key];
    }
  }
  return object as TruthyObject<T>;
};

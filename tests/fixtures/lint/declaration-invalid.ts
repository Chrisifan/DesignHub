export function declaredFunction() {
  return true;
}

export const expressedFunction = function () {
  return true;
};

export const objectWithMethod = {
  method() {
    return true;
  },
};

export class ClassWithMethods {
  constructor() {}

  method() {
    return true;
  }
}

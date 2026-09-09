export function declaredFunction() {
  return true;
}

export const expressedFunction = function () {
  return true;
};

export let mutableArrow = () => true;

export let deferredArrow: () => boolean;
deferredArrow = () => true;

export let { destructuredArrow = () => true } = {};

declare function declaredTypeOnly(): void;

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

abstract class AbstractClass {
  abstract run(): void;
}

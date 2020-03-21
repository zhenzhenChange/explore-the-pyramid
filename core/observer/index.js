/* @flow */

import Dep from './dep';
import VNode from '../vdom/vnode';
import { arrayMethods } from './array';
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering,
} from '../util/index';

const arrayKeys = Object.getOwnPropertyNames(arrayMethods);

/** => 在某些情况下，我们可能希望禁用组件更新计算中的观察
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true;

export function toggleObserving(value: boolean) {
  shouldObserve = value;
}

/** => 附加到每个观察对象的观察者类，附加后，观察者将目标对象的属性键转换为getter/setter，后者收集依赖项并分派更新。
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data => 将此对象作为根$data的vm数

  constructor(value: any) {
    this.value = value;
    this.dep = new Dep();
    this.vmCount = 0;
    def(value, '__ob__', this);

    /* => 观测数组 */
    if (Array.isArray(value)) {
      if (hasProto) {
        /* => 通过改写原型方法进行观测 */
        protoAugment(value, arrayMethods);
      } else {
        copyAugment(value, arrayMethods, arrayKeys);
      }

      /* => 观测数组中的对象 */
      this.observeArray(value);
    } else {
      /* => 观测对象，重新定义对象类型数据 */
      this.walk(value);
    }
  }

  /** => 遍历所有属性并将它们转换为getter/setter。仅当值类型为“对象”时才应调用此方法。
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk(obj: Object) {
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      /* => 定义响应式 */
      defineReactive(obj, keys[i]);
    }
  }

  /** => 观察数组项列表
   * Observe a list of Array items.
   */
  observeArray(items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i]);
    }
  }
}

// helpers

/** => 通过拦截原型方法，观测数组
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment(target, src: Object) {
  target.__proto__ = src;
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment(target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i];
    def(target, key, src[key]);
  }
}

/**
 * Attempt to create an observer instance for a value, => 尝试为值创建观察者实例
 * returns the new observer if successfully observed, => 如果观察成功，则返回新的观察者
 * or the existing observer if the value already has one. => 如果该数据对象已经有一个观察者，则返回现有的观察者
 */
export function observe(value: any, asRootData: ?boolean): Observer | void {
  /* => 必须是对象才能被观测 */
  if (!isObject(value) || value instanceof VNode) {
    return;
  }

  let ob: Observer | void;

  /* => 判断当前对象是否已经被观测过了 */
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__;
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    /* => 否则创建观测者实例 */
    ob = new Observer(value);
  }
  if (asRootData && ob) {
    ob.vmCount++;
  }
  return ob;
}

/** => 在对象上定义响应式属性
 * Define a reactive property on an Object.
 */
export function defineReactive(
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean,
) {
  const dep = new Dep();

  const property = Object.getOwnPropertyDescriptor(obj, key);
  if (property && property.configurable === false) {
    return;
  }

  // cater for pre-defined getter/setters => 迎合预定义的getter/setter
  const getter = property && property.get;
  const setter = property && property.set;
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key];
  }

  /* => 递归观测 */
  let childOb = !shallow && observe(val);

  Object.defineProperty(obj, key, {
    /* => 重新定义成可枚举的、可配置的 */
    enumerable: true,
    configurable: true,

    /* => 获取数据 */
    get: function reactiveGetter() {
      const value = getter ? getter.call(obj) : val;

      /* => 如果调度中心存在 */
      if (Dep.target) {
        /* => 收集依赖 Watcher */
        dep.depend();
        if (childOb) {
          /* => 递归收集依赖 Watcher */
          childOb.dep.depend();
          if (Array.isArray(value)) {
            dependArray(value);
          }
        }
      }
      return value;
    },

    /* => 设置数据 */
    set: function reactiveSetter(newVal) {
      const value = getter ? getter.call(obj) : val;
      /* => 如果新值和旧值一样，则不进行更新 */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return;
      }

      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter();
      }

      // #7981: for accessor properties without setter => 对于不带setter的访问器属性
      if (getter && !setter) return;
      if (setter) {
        setter.call(obj, newVal);
      } else {
        val = newVal;
      }
      childOb = !shallow && observe(newVal);

      /* => 触发数据对应的依赖进行更新 */
      dep.notify();
    },
  });
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set(target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' && (isUndef(target) || isPrimitive(target))) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`);
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key);
    target.splice(key, 1, val);
    return val;
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val;
    return val;
  }
  const ob = (target: any).__ob__;
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' &&
      warn(
        'Avoid adding reactive properties to a Vue instance or its root $data ' +
          'at runtime - declare it upfront in the data option.',
      );
    return val;
  }
  if (!ob) {
    target[key] = val;
    return val;
  }
  defineReactive(ob.value, key, val);
  ob.dep.notify();
  return val;
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del(target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' && (isUndef(target) || isPrimitive(target))) {
    warn(
      `Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`,
    );
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1);
    return;
  }
  const ob = (target: any).__ob__;
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' &&
      warn(
        'Avoid deleting properties on a Vue instance or its root $data ' + '- just set it to null.',
      );
    return;
  }
  if (!hasOwn(target, key)) {
    return;
  }
  delete target[key];
  if (!ob) {
    return;
  }
  ob.dep.notify();
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray(value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i];
    e && e.__ob__ && e.__ob__.dep.depend();
    if (Array.isArray(e)) {
      dependArray(e);
    }
  }
}
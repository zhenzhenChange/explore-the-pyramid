/* @flow */

import config from '../config';
import VNode, { createEmptyVNode } from './vnode';
import { createComponent } from './create-component';
import { traverse } from '../observer/traverse';

import { warn, isDef, isUndef, isTrue, isObject, isPrimitive, resolveAsset } from '../util/index';

import { normalizeChildren, simpleNormalizeChildren } from './helpers/index';

const SIMPLE_NORMALIZE = 1;
const ALWAYS_NORMALIZE = 2;

/* => 包装器函数，提供一个更灵活的接口 */
export function createElement(
  context: Component,
  tag: any,
  data: any,
  children: any,
  normalizationType: any,
  alwaysNormalize: boolean,
): VNode | Array<VNode> {
  if (Array.isArray(data) || isPrimitive(data)) {
    normalizationType = children;
    children = data;
    data = undefined;
  }

  if (isTrue(alwaysNormalize)) normalizationType = ALWAYS_NORMALIZE;

  return _createElement(context, tag, data, children, normalizationType);
}

export function _createElement(
  context: Component,
  tag?: string | Class<Component> | Function | Object,
  data?: VNodeData,
  children?: any,
  normalizationType?: number,
): VNode | Array<VNode> {
  if (isDef(data) && isDef(data.__ob__)) {
    // => 避免使用观察到的数据对象作为 vnode 数据：JSON.stringify(data) 总是在每个渲染函数中创建新的 vnode 数据对象!
    process.env.NODE_ENV !== 'production' &&
      warn(
        `Avoid using observed data object as vnode data: ${JSON.stringify(data)}. Always create fresh vnode data objects in each render!`,
        context,
      );

    return createEmptyVNode();
  }

  // => v-bind中的对象语法
  if (isDef(data) && isDef(data.is)) tag = data.is;

  // => 是组件的情况下：设置为假值
  if (!tag) return createEmptyVNode();

  // => 警告非原生键
  if (process.env.NODE_ENV !== 'production' && isDef(data) && isDef(data.key) && !isPrimitive(data.key)) {
    // => 避免使用非原生值作为键，而是使用字符串/数字值。
    if (!__WEEX__ || !('@binding' in data.key)) warn('Avoid using non-primitive value as key, use string/number value instead.', context);
  }

  // => 支持单个子函数作为默认的作用域插槽
  if (Array.isArray(children) && typeof children[0] === 'function') {
    data = data || {};
    data.scopedSlots = { default: children[0] };
    children.length = 0;
  }

  if (normalizationType === ALWAYS_NORMALIZE) {
    children = normalizeChildren(children);
  } else if (normalizationType === SIMPLE_NORMALIZE) {
    children = simpleNormalizeChildren(children);
  }

  let vnode, ns;
  if (typeof tag === 'string') {
    let Ctor;
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag);
    if (config.isReservedTag(tag)) {
      // => 平台内置的元素
      if (process.env.NODE_ENV !== 'production' && isDef(data) && isDef(data.nativeOn)) {
        // => v-on 的 .native 修饰符仅对组件有效，但它用于 tag 。
        warn(`The .native modifier for v-on is only valid on components but it was used on <${tag}>.`, context);
      }

      vnode = new VNode(config.parsePlatformTagName(tag), data, children, undefined, undefined, context);
    } else if ((!data || !data.pre) && isDef((Ctor = resolveAsset(context.$options, 'components', tag)))) {
      // => 创建组件
      vnode = createComponent(Ctor, data, context, children, tag);
    } else {
      // => 未知或未列出的带名称空间的元素在运行时进行检查，因为在父元素规范化子元素时可能会分配名称空间
      vnode = new VNode(tag, data, children, undefined, undefined, context);
    }
  } else {
    // => 正好是组件选项/构造函数
    vnode = createComponent(tag, data, context, children);
  }

  if (Array.isArray(vnode)) {
    return vnode;
  } else if (isDef(vnode)) {
    if (isDef(ns)) applyNS(vnode, ns);
    if (isDef(data)) registerDeepBindings(data);
    return vnode;
  } else {
    return createEmptyVNode();
  }
}

function applyNS(vnode, ns, force) {
  vnode.ns = ns;
  if (vnode.tag === 'foreignObject') {
    // => 在项目中使用默认的命名空间
    ns = undefined;
    force = true;
  }

  if (isDef(vnode.children)) {
    for (let i = 0, l = vnode.children.length; i < l; i++) {
      const child = vnode.children[i];
      if (isDef(child.tag) && (isUndef(child.ns) || (isTrue(force) && child.tag !== 'svg'))) applyNS(child, ns, force);
    }
  }
}

/* => 在插槽节点上使用 :style 和 :class 这样的深度绑定时，需要确保父节点重新渲染 */
function registerDeepBindings(data) {
  if (isObject(data.style)) traverse(data.style);

  if (isObject(data.class)) traverse(data.class);
}

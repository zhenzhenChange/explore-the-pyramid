/* @flow */

import { extend } from 'shared/util';
import { detectErrors } from './error-detector';
import { createCompileToFunctionFn } from './to-function';

export function createCompilerCreator(baseCompile: Function): Function {
  return function createCompiler(baseOptions: CompilerOptions) {
    function compile(template: string, options?: CompilerOptions): CompiledResult {
      const tips = [];
      const errors = [];
      const finalOptions = Object.create(baseOptions);

      let warn = (msg, range, tip) => {
        (tip ? tips : errors).push(msg);
      };

      if (options) {
        if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
          const leadingSpaceLength = template.match(/^\s*/)[0].length;

          warn = (msg, range, tip) => {
            const data: WarningMessage = { msg };
            if (range) {
              if (range.start != null) {
                data.start = range.start + leadingSpaceLength;
              }
              if (range.end != null) {
                data.end = range.end + leadingSpaceLength;
              }
            }
            (tip ? tips : errors).push(data);
          };
        }

        // merge custom modules => 合并定制模块
        if (options.modules) {
          finalOptions.modules = (baseOptions.modules || []).concat(options.modules);
        }

        // merge custom directives => 合并定制指令
        if (options.directives) {
          finalOptions.directives = extend(Object.create(baseOptions.directives || null), options.directives);
        }

        // copy other options => 复制其他选项
        for (const key in options) {
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key];
          }
        }
      }

      finalOptions.warn = warn;

      const compiled = baseCompile(template.trim(), finalOptions);

      if (process.env.NODE_ENV !== 'production') {
        detectErrors(compiled.ast, warn);
      }

      compiled.errors = errors;
      compiled.tips = tips;

      return compiled;
    }

    return { compile, compileToFunctions: createCompileToFunctionFn(compile) };
  };
}

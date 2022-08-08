/* eslint-disable arrow-parens */
/* eslint-disable require-jsdoc */
/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable new-cap */
/* eslint-disable brace-style */
import * as _ from '../main.mjs';

describe('Module-level tests', ()=>{
    test('Module default export expected value', ()=>{
        expect(_).toHaveProperty('default');
        expect(_.default).toBeInstanceOf(Function);
    });
});

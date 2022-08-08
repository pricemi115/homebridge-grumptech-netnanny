/* eslint-disable arrow-parens */
/* eslint-disable require-jsdoc */
/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable new-cap */
/* eslint-disable brace-style */
import * as _ from '../networkTarget.mjs';

describe('Module-level tests', ()=>{
    test('Module VolumeWatcher export expected value', ()=>{
        const netTarget = new _.NetworkTarget();
        expect(netTarget).toBeInstanceOf(_.NetworkTarget);
    });
    test('Module Enumerations export expected value', ()=>{
        expect(_.TARGET_TYPES).toBeInstanceOf(Object);
        expect(_.PEAK_TYPES).toBeInstanceOf(Object);
        expect(_.DATA_BUFFER_TYPES).toBeInstanceOf(Object);
        expect(_.ALERT_BITMASK).toBeInstanceOf(Object);
        expect(_.ALERT_BITMASK).toBeInstanceOf(Object);
    });
    describe('Module TARGET_TYPES expected value(s)', ()=>{
        test('TARGET_TYPES size test', ()=>{
            expect(Object.values(_.TARGET_TYPES).length).toBe(5);
        });
        describe.each([
            ['URI',         'URI',          'uri'],
            ['IPV4',        'IPV4',         'ipv4'],
            ['IPV6',        'IPV6',         'ipv6'],
            ['GATEWAY',     'GATEWAY',      'gateway'],
            ['CABLE_MODEM', 'CABLE_MODEM',  'cable_modem'],
        ])('Enumeration exists.', (desc, input, result) =>{
            test(desc, ()=>{
                expect(_.TARGET_TYPES).toHaveProperty(input, result);
            });
        });
    });
    describe('Module PEAK_TYPES expected value(s)', ()=>{
        test('PEAK_TYPES size test', ()=>{
            expect(Object.values(_.PEAK_TYPES).length).toBe(3);
        });
        describe.each([
            ['LATENCY', 'LATENCY',  'peak_latency'],
            ['JITTER',  'JITTER',   'peak_jitter'],
            ['LOSS',    'LOSS',     'peak_packet_loss'],
        ])('Enumeration exists.', (desc, input, result) =>{
            test(desc, ()=>{
                expect(_.PEAK_TYPES).toHaveProperty(input, result);
            });
        });
    });
    describe('Module DATA_BUFFER_TYPES expected value(s)', ()=>{
        test('DATA_BUFFER_TYPES size test', ()=>{
            expect(Object.values(_.PEAK_TYPES).length).toBe(3);
        });
        describe.each([
            ['LATENCY', 'LATENCY',  'data_latency'],
            ['JITTER',  'JITTER',   'data_jitter'],
            ['LOSS',    'LOSS',     'data_packet_loss'],
        ])('Enumeration exists.', (desc, input, result) =>{
            test(desc, ()=>{
                expect(_.DATA_BUFFER_TYPES).toHaveProperty(input, result);
            });
        });
    });
    describe('Module ALERT_BITMASK expected value(s)', ()=>{
        test('ALERT_BITMASK size test', ()=>{
            expect(Object.values(_.ALERT_BITMASK).length).toBe(5);
        });
        describe.each([
            ['NONE',    'NONE',     0],
            ['LATENCY', 'LATENCY',  1],
            ['LOSS',    'LOSS',     2],
            ['JITTER',  'JITTER',   4],
            ['ALL',     'ALL',      7],
        ])('Enumeration exists.', (desc, input, result) =>{
            test(desc, ()=>{
                expect(_.ALERT_BITMASK).toHaveProperty(input, result);
            });
        });
    });
});

/* eslint-env jest */
import paper from '@scratch/paper';
import fillColorReducer, {changeFillColor} from '../../src/reducers/fill-style';
import strokeColorReducer, {changeStrokeColor} from '../../src/reducers/stroke-style';
import {setSelectedItems} from '../../src/reducers/selected-items';
import {MIXED} from '../../src/helper/style-path';
import GradientTypes from '../../src/lib/gradient-types';
import {mockPaperRootItem} from '../__mocks__/paperMocks';


let defaultState;
for (const [colorReducer, changeColor, colorProp] of [
    [fillColorReducer, changeFillColor, 'fillColor'],
    [strokeColorReducer, changeStrokeColor, 'strokeColor']
]) {
    test('initialState', () => {
        expect(colorReducer(defaultState /* state */, {type: 'anything'} /* action */)).toBeDefined();
    });

    test('changeColor', () => {
        const oldColor = new paper.Color('#010');
        const newColor = new paper.Color('#fff');
        expect(colorReducer(defaultState /* state */, changeColor(newColor) /* action */).primary)
            .toEqual(newColor);
        expect(colorReducer({
            primary: oldColor,
            secondary: null,
            gradientType: GradientTypes.SOLID
        } /* state */, changeColor(newColor) /* action */).primary)
            .toEqual(newColor);
    });

    test('changeColorToTransparent', () => {
        const oldColor = new paper.Color('#010');
        const newColor = null;
        expect(colorReducer(defaultState /* state */, changeColor(newColor) /* action */).primary)
            .toEqual(newColor);
        expect(colorReducer({
            primary: oldColor,
            secondary: null,
            gradientType: GradientTypes.SOLID
        } /* state */, changeColor(newColor) /* action */).primary)
            .toEqual(newColor);
    });
    
    test('changeColorToMixed', () => {
        const oldColor = new paper.Color('#010');
        const newColor = MIXED;
        expect(colorReducer(defaultState /* state */, changeColor(newColor) /* action */).primary)
            .toEqual(newColor);
        expect(colorReducer({
            primary: oldColor,
            secondary: null,
            gradientType: GradientTypes.SOLID
        } /* state */, changeColor(newColor) /* action */).primary)
            .toEqual(newColor);
    });
    
    test('changeColorViaSelectedItems', () => {
        const color1 = new paper.Color('rgba(6, 0, 0, 0.5)');
        const color2 = null; // transparent
        let selectedItems = [mockPaperRootItem({[colorProp]: color1, strokeWidth: 1})];
        expect(colorReducer(defaultState /* state */, setSelectedItems(selectedItems) /* action */).primary)
            .toEqual(color1);
        selectedItems = [mockPaperRootItem({[colorProp]: color2, strokeWidth: 1})];
        expect(colorReducer(defaultState /* state */, setSelectedItems(selectedItems) /* action */).primary)
            .toEqual(color2);
        selectedItems = [
            mockPaperRootItem({[colorProp]: color1, strokeWidth: 1}),
            mockPaperRootItem({[colorProp]: color2, strokeWidth: 1})
        ];
        expect(colorReducer(defaultState /* state */, setSelectedItems(selectedItems) /* action */).primary)
            .toEqual(MIXED);
    });

    test('invalidChangeColor', () => {
        const origState = {primary: paper.Color.WHITE, secondary: null, gradientType: GradientTypes.SOLID};

        expect(colorReducer(origState /* state */, changeColor() /* action */))
            .toBe(origState);
        expect(colorReducer(origState /* state */, changeColor('#') /* action */))
            .toBe(origState);
        expect(colorReducer(origState /* state */, changeColor('invalid argument') /* action */))
            .toBe(origState);
    });

}

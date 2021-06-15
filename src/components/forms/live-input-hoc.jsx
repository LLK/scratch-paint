import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';

/**
 * Higher Order Component to manage inputs that submit on change and <enter>
 * @param {React.Component} Input text input that consumes onChange, onBlur, onKeyPress
 * @returns {React.Component} Live input that calls onSubmit on change and <enter>
 */
export default function (Input) {
    class LiveInput extends React.Component {
        constructor (props) {
            super(props);
            bindAll(this, [
                'handleChange',
                'handleKeyPress',
                'handleFlush',
                'handleFocus'
            ]);
            this.state = {
                value: null
            };

            // Track whether the input is currently focused.
            // This is a class variable because it doesn't need to trigger re-renders
            this.focused = false;
        }
        handleKeyPress (e) {
            if (e.key === 'Enter') {
                this.handleChange(e);
                e.target.blur();
            }
        }
        handleFlush () {
            this.setState({value: null});
            this.focused = false;
        }
        handleFocus (e) {
            this.setState({value: e.target.value});
            this.focused = true;
        }
        handleChange (e) {
            const isNumeric = typeof this.props.value === 'number';
            const validatesNumeric = isNumeric ? !isNaN(e.target.value) : true;
            if (e.target.value !== null && validatesNumeric) {
                let val = Number(e.target.value);
                if (typeof this.props.max !== 'undefined' && val > Number(this.props.max)) {
                    val = this.props.max;
                }
                if (typeof this.props.min !== 'undefined' && val < Number(this.props.min)) {
                    val = this.props.min;
                }
                this.props.onSubmit(val);
            }
            // In Firefox, clicking the arrow buttons on a number input changes its value without focusing it.
            // Make sure that we only set this.state.value (which overrides this.props.value) if the input is actually
            // focused.
            if (this.focused) this.setState({value: e.target.value});
        }
        render () {
            const liveValue = this.state.value === null ? this.props.value : this.state.value;
            return (
                <Input
                    {...this.props}
                    value={liveValue}
                    onBlur={this.handleFlush}
                    onFocus={this.handleFocus}
                    onChange={this.handleChange}
                    onKeyPress={this.handleKeyPress}
                />
            );
        }
    }

    LiveInput.propTypes = {
        max: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        min: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        onSubmit: PropTypes.func.isRequired,
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    };

    return LiveInput;
}

define(["react", "react-class", "draw/Text", "../../Template"], function Serial(React, ReactClass, Text, Template)
{
	var Serial = ReactClass({
		render: function render()
		{
			return React.createElement(Text, { text: this.props.value, style: Object.assign({
				fontFamily: ["ITC Stone Serif LT", "serif"],
				color: this.props.color,
				fontSize: 12,
				textAlign: "left",
				whitespace: "nowrap",

			}, Template.footer.serial), canvas: this.props.canvas, repaint: this.props.repaint })
		}
	});
	Serial.displayName = "Serial";
	Serial.defaultProps = {
		value: "",
		color: "black"
	};
	return Serial;
});

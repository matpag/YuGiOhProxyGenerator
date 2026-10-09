define(["react", "react-class", "draw/Text", "../../Template"], function Link(React, ReactClass, Text, Template)
{
	var style = {
		fontFamily: ["IDroid", "sans-serif"],
		fontSize: 16,
		textAlign: "right",
		whitespace: "nowrap",

	};
	Object.assign(style, Template.stats.link);

	var Link = ReactClass({
		render: function render()
		{
			return React.createElement(Text, { text: this.props.value, style: style, repaint: this.props.repaint, canvas: this.props.canvas })
		}
	});

	Link.displayName = "Link";
	Link.defaultProps = {

	}
	return Link;
});

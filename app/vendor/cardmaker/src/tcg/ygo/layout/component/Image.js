define(["react", "react-class", "draw/Image", "../../Rarities", "../../Template"], function Image(React, ReactClass, Img, Rarities, Template)
{
	var styles = { Normal: Template.artwork.regular, Pendulum: Template.artwork.pendulum };

	var Image = ReactClass({
		render: function render()
		{
			var style = this.props.pendulum ? styles.Pendulum : styles.Normal;
			var foil = React.createElement("span");
			return React.createElement(
				React.Fragment,
				null,
				React.createElement(
					Img, 
					{
						src: this.props.value, 
						style: style,
						repaint: this.props.repaint, 
						canvas: this.props.canvas 
					}
				),
				React.createElement(
					Img,
					{
						src: (Rarities[this.props.rarity] || {}).foil,
						style: Object.assign({}, style, { mixBlendMode: "color-dodge"}),
						repaint: this.props.repaint, 
						canvas: this.props.canvas 
						
					}
				)
			);
		}
	});
	Image.displayName = "Image";
	Image.defaultProps = {
		rarity: "common"
	};
	return Image;
});

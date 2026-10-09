define(["react", "react-class"], function Image(React, ReactClass)
{
	/**
	 * Image to draw on a canvas.
	 *
	 * In case no canvas DOM element is provided to it, it should default to 
	 * a regular DOM image.
	 */
	var image = ReactClass({
		getInitialState: function initialState()
		{
			return { image: null };
		},
		
		render: function render()
		{
			return React.createElement(
				"img",
				{
					src: this.props.src,
                    ref: function(node) { this.image = node; }.bind(this),
					crossOrigin: "anonymous",
					onLoad: this.onLoad,
					style: {
						position: "absolute",
						left: this.props.style.left,
						top: this.props.style.top,
						width: this.props.style.width,
						height: this.props.style.height,
						mixBlendMode: this.props.style.mixBlendMode
					}
				}
			)
		},
		
		onLoad: function loaded(img)
		{
			this.setState({ image: img.target });
			this.props.repaint();
		},
		
		componentDidUpdate: function()
		{
			var canvas = this.props.canvas;
			// Make sure the image has downloaded.
			if (canvas !== null && this.image && this.image.complete && this.image.naturalWidth > 0)
			{
				var ctx = canvas.getContext("2d");
				ctx.save();
				ctx.globalCompositeOperation = this.props.style.mixBlendMode;
				ctx.drawImage(
					this.image, 
					this.props.style.left, 
					this.props.style.top, 
					// Width and height might not be provided, default to the dimensions
					// of the specified image in that case. Note that a width of 0 results
					// in the default size.
					this.props.style.width || this.image.width, 
					this.props.style.height || this.image.height
				);
                if (this.props.canvasFilter && this.props.canvasFilterRegions) {
                    ctx.beginPath();
                    this.props.canvasFilterRegions.forEach(function(rect) {
                        ctx.rect(rect[0], rect[1], rect[2], rect[3]);
                    });
                    ctx.clip();
                    ctx.filter = this.props.canvasFilter;
                    ctx.drawImage(this.image, this.props.style.left, this.props.style.top,
                        this.props.style.width || this.image.width,
                        this.props.style.height || this.image.height);
                }
				ctx.restore();
			}
		}
	});
	// The compiler warns about "getDefaultProps" being deprecated.
	// Assigning them this way seems to solve it.
	image.defaultProps = {
		style: {
			left: 0, // 
			top: 0,
			width: undefined, 
			height: undefined, 
			mixBlendMode: "normal"
		},
		canvas: null, 
		repaint: function repaint(){/* Empty function.*/} 
	};
	
	return image;
});

class Face {
	constructor(v1, v2, v3){
		this.vertex1 = v1;
		this.vertex2 = v2;
		this.vertex3 = v3;
		this.vertices = [this.vertex1, this.vertex2, this.vertex3];
	}
	
	// Checks if a given point is inside the face triangle
	isPointInside(point, worldTransform){
		let isInside = false;
		
		for (let i = 0; i < this.vertices.length; i++){

			// Define vi and vj based on current index. Apply the mesh's world transform
			const vi = this.vertices[i]
						.copy().applyMatrix3(worldTransform);
			
			const vj = this.vertices[(i + 1) % this.vertices.length]
						.copy().applyMatrix3(worldTransform);
			
			// Check if the point is above or below both vertices. If results are equal, skip; if not, continue, it means we are inbetween.
			if (point.y < vi.y !== point.y < vj.y){
				
				// This formula checks if the point would intersect the line traced by the 2 current vertices (vi and vj).
				// To do this, we take the length of the line on the x axis, then multiply by a fraction.
				// This fraction represents the position of the point between vi and vj along the y axis.
				// Because vi-vj is a straight line, the point will cross the diagonal at exactly the same fraction on the x and y axis.
				// The result we get is the x position at which the point intersects with the line. We just need to add vi.x's offset.
				// Now we can check: if the x-coordinate of the point is smaller, it means it lies to the left of the line and will intersect.
				if (point.x < ((vj.x - vi.x) * (point.y - vi.y) / (vj.y - vi.y) + vi.x)){
					// We use the even-odd method to check if the point is inside the triangle.
					// If the point intersects, invert the isInside value. Crossing an odd number of times means we're inside.
					isInside = !isInside;
				}
			}
		}
		
		return isInside;
		
	}
}

export { Face };

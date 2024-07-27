// A matrix allows to store a translation, rotation and scale value in a single container.
// The matrix containers can be multiplied together to chain multiple transforms.
// This allows applying multiple transforms one after the other easily by using matrix.multiply(m1).multiply(m2).multiply(m3), etc.

class Matrix3 {
	constructor(n11, n21, n31, n12, n22, n32, n13, n23, n33){
	
		// Make an array to store each element. Start by setting the matrix to identity
		this.elements = [ 
			1, 0, 0,
			0, 1, 0,
			0, 0, 1	
		];

		// If parameters were used when creating the matrix, set it using the given parameters
		if (n11 !== undefined){
			this.set(n11, n21, n31, n12, n22, n32, n13, n23, n33);
		} 
	}
	
	// Set the matrix to a new transform using a series of parameters
	set(n11, n21, n31, n12, n22, n32, n13, n23, n33){
		const e = this.elements;
		e[0] = n11; e[1] = n21; e[2] = n31;
		e[3] = n12; e[4] = n22; e[5] = n32;
		e[6] = n13; e[7] = n23; e[8] = n33;
		
		return this;
	}
	
	// Multiply the current matrix with a new matrix. Allows chaining by returning the result, which is still a matrix.
	multiply(m){
		return this.multiplyMatrices(this, m);
	}
	
	// Multiply matrices a and b together
	multiplyMatrices(a, b){
	
		// Start by storing the elements array in a variable for each
		const ae = a.elements;
		const be = b.elements;
		const e = this.elements;
		
		// Create a variable for each element of array a so they can be multiplied
		const a11 = ae[0], a12 = ae[3], a13 = ae[6];
		const a21 = ae[1], a22 = ae[4], a23 = ae[7];
		const a31 = ae[2], a32 = ae[5], a33 = ae[8];
		
		// Create a variable for each element of array b so they can be multiplied
		const b11 = be[0], b12 = be[3], b13 = be[6];
		const b21 = be[1], b22 = be[4], b23 = be[7];
		const b31 = be[2], b32 = be[5], b33 = be[8];
		
		// To get the first vector column, calculate a dot product of the first column of a with each row of b
		e[0] = a11 * b11 + a12 * b21 + a13 * b31;
		e[3] = a11 * b12 + a12 * b22 + a13 * b32;
		e[6] = a11 * b13 + a12 * b23 + a13 * b33;
		
		// To get the second vector column, use the second column of a with each row of b.
		e[1] = a21 * b11 + a22 * b21 + a23 * b31;
		e[4] = a21 * b12 + a22 * b22 + a23 * b32;
		e[7] = a21 * b13 + a22 * b23 + a23 * b33;
		
		// To get the third vector column, use the third column of a with each row of b.
		e[2] = a31 * b11 + a32 * b21 + a33 * b31;
		e[5] = a31 * b12 + a32 * b22 + a33 * b32;
		e[8] = a31 * b13 + a32 * b23 + a33 * b33;
		
		return this;
		
	}

	identity(){
		this.set(
			1, 0, 0,
			0, 1, 0,
			0, 0, 1);

		return this;
	}

	copy(){
		const e = this.elements;
		return new Matrix3(
			e[0], e[1], e[2],
			e[3], e[4], e[5],
			e[6], e[7], e[8]);
	}
	
	// Generate translation matrix based on supplied x and y values
	makeTranslation(v){
		const [x, y] = [v.x, v.y];
		this.set(
			1, 0, x,
			0, 1, y,
			0, 0, 1);
		
		return this;
	}
	
	// Generate rotation matrix based on supplied angle.
	makeRotation(a){
		const c = Math.cos(a);
		const s = Math.sin(a);
		
		// Clockwise
		this.set(
			c, -s, 0,
			s, c, 0,
			0, 0, 1);
					
		return this;

	// If we were simply generating a new vector, it would look like this:
		// rotatedX = this.x * cos - this.y * sin;
		// rotatedY = this.x * sin + this.y * cos;
	// To understand how this works, imagine the vector as a right-angled triangle lying flat on the ground.
	// Once rotated, this triangle will have space under and above it, which also form triangles.
	// The bottom triangle's hypothenuse is the same length as the original X value, which means its width = adjacent edge * cos(angle)
	// Similary, the top triangle's hypothenuse is the same as the original Y value, so the top width = opposite edge * sin(angle)
	// Take the bottom width minus the top width and you get the new rotated X value.
	// You can can work out rotatedY the same way, except this time you add up the two opposite edges to get the total height.
	// Now since we're generation a matrix, we need to position sin and cos in a way that they will be added together correctly.
	// Luckily, the operation already looks much like a matrix dot product so it is easy to transfer as seen above.
	}
	
	// Generate scale matrix based on supplied vector
	makeScale(v){
		const [x, y] = [v.x, v.y];
		this.set(
			x, 0, 0,
			0, y, 0,
			0, 0, 1);
		
		return this;
	}
	
	// Rotate current matrix based on supplied angle
	rotate(a){
		this.multiply(m3.makeRotation(a));
		
		return this;
	}
	
	// Translate current matrix based on supplied vector
	translate(v){
		this.multiply(m3.makeTranslation(v));
		
		return this;
	}
	
	// Scale current matrix based on supplied vector
	scale(v){
		this.multiply(m3.makeScale(v));
		
		return this;
	}
}

// Temporary matrix container to avoid making new Matrix objects every calculation.
// Gets cleared and set to new values using makeTranslate, makeRotate and makeScale.
const m3 = new Matrix3();

export { Matrix3 };

	
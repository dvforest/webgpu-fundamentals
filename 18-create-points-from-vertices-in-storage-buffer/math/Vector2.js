class Vector2 {
	constructor(x = 0, y = 0) {
		this.x = x;
		this.y = y;
	}

	add(vector) {
		this.x += vector.x;
		this.y += vector.y;
	}

	substract(vector) {
		this.x -= vector.x;
		this.y -= vector.y;
	}

	scale(scalar) {
		this.x *= scalar;
		this.y *= scalar;
	}

	magnitude() {
		return Math.sqrt(this.x ** 2 + this.y ** 2);
	}

	normalize() {
		const magnitude = this.magnitude();
		if (magnitude !== 0) {
			this.scale(1 / magnitude);
		}
	}

	set(x, y) {
		this.x = x;
		this.y = y;
		
		return this;
	}

	copy(){		
		return new Vector2(this.x, this.y);
	}

	applyMatrix3(m){
		const e = m.elements;
		const [x, y] = [this.x, this.y]; 
		this.x = e[0] * x + e[1] * y + e[2];
		this.y = e[3] * x + e[4] * y + e[5];
		
		return this;
	}
}

export {Vector2};
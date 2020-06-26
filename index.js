/* LZ2TreeFile decompressor.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// This needs to be refactored into a stream transform function.

const fs = require('fs');

const input = fs.readFileSync('/dev/stdin');

let lbLen = 0;
let lbDist = 0;
let escape = 0x16;

let offInput = 0;

let output = new Uint8Array(65536);
output.used = 0;

function append(chunk)
{
	if (output.used + chunk.length > output.length) {
		let n = new Uint8Array(output.length + 65536);
		n.set(output);
		n.used = output.used;
		output = n;
	}
	output.set(chunk, output.used);
	output.used += chunk.length;
}

while (offInput < input.length) {

	if (lbLen) {
		const offOutput = output.used - lbDist;

		// If the length goes past the end of the output data, repeat the last
		// character until the length is reached.
		let repeat = offOutput + lbLen - output.used;
		if (repeat < 0) repeat = 0;

		const chunk = output.slice(offOutput, offOutput + lbLen - repeat);
		append(chunk);

		if (repeat) {
			const repeatChunk = new Uint8Array(repeat);
			repeatChunk.fill(chunk[chunk.length - 1]);
			append(repeatChunk);
		}
		lbLen = 0;
	}

	if (escape) {
		let chunk = input.slice(offInput, offInput + escape);
		append(chunk);
		offInput += escape;
		escape = 0;
	}

	const flag = input[offInput++];
	lbLen = flag >> 5;

	if (lbLen) {

		if (lbLen === 7) {
			let next;
			do {
				next = input[offInput++];
				lbLen += next;
			} while (next == 0xff);
		}

		lbLen += 2;

		lbDist = (flag & 0x1F) << 8;
		lbDist += 1 + input[offInput++];

		if (lbDist === 0x2000) {
			// Max distance value possible, next two bytes are a 16-bit value to add.
			lbDist += input[offInput++] << 8;
			lbDist += input[offInput++];
		}

	} else {
		escape = flag + 1;
	}
}

// Trim excess
output = output.slice(0, output.used);

process.stdout.write(output);

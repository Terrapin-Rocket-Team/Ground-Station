def remove_every_other_byte(input_filename, output_filename):
    # Open the input file in binary read mode
    with open(input_filename, 'rb') as infile:
        # Read the entire file content
        data = infile.read()
    
    # Create a new byte array with every other byte removed, starting with the first byte
    filtered_data = data[1::2]

    # Open the output file in binary write mode
    with open(output_filename, 'wb') as outfile:
        # Write the filtered data to the output file
        outfile.write(filtered_data)

# Example usage
input_filename = 'debug.log'
output_filename = 'debug.av1'
remove_every_other_byte(input_filename, output_filename)

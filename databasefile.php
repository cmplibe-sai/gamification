<?php
$conn = new mysqli("sql209.infinityfree.com", "if0_41427705", "Hqi18GppoRNj9N", "if0_41427705_cb_testing");
$sql = "INSERT INTO firsttable VALUES (1, 'SAI')";
if ($conn->query($sql)) {
    echo "value inserted";
} else {
echo "insertion failed";
}
$conn->close();
?>
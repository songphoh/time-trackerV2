// กำหนด URL ของ API
var scripturl = '/api';
var owner = 'งานเทคโนโลยีสารสนเทศ' + '\n' + 'อบต.ข่าใหญ่';

// ตัวแปรสำหรับเก็บข้อมูลโปรไฟล์และพิกัด
var profile = null;
var gps;
var locationPermissionGranted = false; // เพิ่มตัวแปรสถานะการอนุญาตใช้ตำแหน่ง

// เมื่อโหลดหน้าเสร็จ
$(document).ready(function () {
  // กำหนดการทำงานของปุ่ม
  $('#clockin').click(() => requestLocationAndClockIn());
  $('#clockout').click(() => requestLocationAndClockOut());
  
  // แสดงเวลา
  showTime();
  
  // เริ่มดึงตำแหน่ง GPS แต่ไม่บังคับ (จะแสดง UI สวยงามตอนกดปุ่มลงเวลา)
  getlocation(false);

  // ดึง LIFF ID จากฐานข้อมูล
  $.ajax({
    method: "GET",
    url: "/api/getLiffId",
    success: function(response) {
      if (response && response.liffId) {
        initializeLiff(response.liffId);
      } else {
        console.error("ไม่พบ LIFF ID ในฐานข้อมูล");
        $('#message').html("ไม่สามารถเชื่อมต่อกับ LINE ได้ กรุณาติดต่อผู้ดูแลระบบ");
        document.getElementById('message').className = 'alert alert-danger';
      }
    },
    error: function(error) {
      console.error("เกิดข้อผิดพลาดในการดึง LIFF ID", error);
      $('#message').html("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
      document.getElementById('message').className = 'alert alert-danger';
    }
  });
});

function initializeLiff(liffId) {
  console.log("กำลังเริ่มต้น LIFF ด้วย ID:", liffId);
  
  // เริ่มต้น LINE LIFF
  liff.init({
    liffId: liffId,
    withLoginOnExternalBrowser: true
  }).then(() => {
    console.log("LIFF initialized successfully");
    
    // ตรวจสอบว่าได้เข้าสู่ระบบแล้วหรือไม่
    if (!liff.isLoggedIn()) {
      console.log("User not logged in, triggering login");
      liff.login();
      return;
    }
    
    // ดึงข้อมูลโปรไฟล์
    try {
      // ใช้ liff.getProfile() แทน getDecodedIDToken()
      liff.getProfile().then(userProfile => {
        profile = userProfile;
        console.log("🚀 ~ profile:", profile);
        console.log("User ID: " + profile.userId);
        console.log("Display Name: " + profile.displayName);
        console.log("Picture URL: " + (profile.pictureUrl || "ไม่พบรูปโปรไฟล์"));
        
        // เริ่มต้นแอป
        initApp();
      }).catch(err => {
        console.error("Error getting profile:", err);
        // กรณีไม่สามารถดึงโปรไฟล์ได้ แต่ยังใช้งานต่อได้
        initApp();
      });
    } catch (err) {
      console.error("Error in profile retrieval:", err);
      // กรณีเกิดข้อผิดพลาด แต่ยังใช้งานต่อได้
      initApp();
    }
  }).catch(err => {
    console.error("LIFF initialization failed", err);
    $('#message').html("ไม่สามารถเชื่อมต่อกับ LINE ได้ กรุณาติดต่อผู้ดูแลระบบ");
    document.getElementById('message').className = 'alert alert-danger';
    
    // แม้จะมีปัญหากับ LIFF ก็ยังให้ใช้งานแอปได้
    initApp();
  });
}

// ฟังก์ชันเริ่มต้นแอป
function initApp() {
  document.getElementById('message').innerText = owner;
  document.getElementById('message').className = 'alert msgBg';
  
  // ดึงรายชื่อพนักงานสำหรับ autocomplete
  $.ajax({
    method: "POST",
    url: scripturl + "/getdata",
    data: {},
    success: function (dataPerson) {
      console.log(dataPerson);
      $(function () {
        var availableTags = dataPerson;
        $("#employee").autocomplete({
          maxShowItems: 3,
          source: availableTags
        });
      });
    }
  });

  // ดึงรายชื่อพนักงานสำหรับ dropdown
  getEmployees();
}

// ฟังก์ชันดึงรายชื่อพนักงาน
function getEmployees() {
  $.ajax({
    method: "POST",
    url: scripturl + "/getemployee",
    data: {},
    success: function (ar) {
      var employeeSelect = document.getElementById("employee");

      let option = document.createElement("option");
      option.value = "";
      option.text = "";
      employeeSelect.appendChild(option);

      ar.forEach(function (item, index) {
        let option = document.createElement("option");
        var employee = item[0];
        option.value = item[0];
        option.text = item[0];
        employeeSelect.appendChild(option);
      });
    }
  });
}

// ฟังก์ชันดึงเวลาไคลเอ็นต์พร้อมดีบั๊ก
function getClientTime() {
  // สร้างวัตถุเวลาปัจจุบัน
  var currentTime = new Date();
  
  // แปลงเป็นใช้เวลา UTC ตามมาตรฐาน
  var isoString = currentTime.toISOString();
 
  // แสดงข้อมูลการดีบั๊ก
  console.group('Client Time Debugging');
  console.log('Original Time (Local):', currentTime);
  console.log('Original Time (ISO):', isoString);
  console.log('Timezone Offset:', 
    -currentTime.getTimezoneOffset(), 
    'minutes (Difference from UTC)'
  );
  console.groupEnd();
 
  // คืนค่าเวลาในรูปแบบ ISO string (ซึ่งเป็น UTC)
  return isoString;
}

// ฟังก์ชันขอตำแหน่งทางภูมิศาสตร์ก่อนลงเวลาเข้า
function requestLocationAndClockIn() {
  event.preventDefault();
  var employee = document.getElementById("employee").value;
  
  if (employee === '') {
    $('#message').html('กรุณาเลือกรายชื่อพนักงาน ...!');
    document.getElementById('message').className = 'alert alert-warning text-danger';
    return;
  }
  
  // แสดงกล่องขออนุญาตใช้ตำแหน่ง
  showLocationPermissionDialog(function(allowed) {
    if (allowed) {
      // ดึงตำแหน่งปัจจุบันก่อนลงเวลา
      getlocation(true, function(success) {
        if (success) {
          // ดำเนินการลงเวลาเข้าเมื่อได้ตำแหน่งแล้ว
          ClockIn();
        } else {
          $('#message').html('ไม่สามารถดึงตำแหน่งพิกัดได้ กรุณาตรวจสอบการตั้งค่าอุปกรณ์ของคุณ');
          document.getElementById('message').className = 'alert alert-danger';
        }
      });
    } else {
      // กรณีไม่อนุญาตใช้ตำแหน่ง
      $('#message').html('คุณไม่อนุญาตการใช้งานตำแหน่งที่ตั้ง การลงเวลาจะไม่มีข้อมูลพิกัด');
      document.getElementById('message').className = 'alert alert-warning';
      
      // ลงเวลาแม้ไม่มีพิกัด
      setTimeout(function() {
        ClockIn();
      }, 1500);
    }
  });
}

// ฟังก์ชันขอตำแหน่งทางภูมิศาสตร์ก่อนลงเวลาออก
function requestLocationAndClockOut() {
  event.preventDefault();
  var employee = document.getElementById("employee").value;
  
  if (employee === '') {
    $('#message').html('กรุณาเลือกรายชื่อพนักงาน ...!');
    document.getElementById('message').className = 'alert alert-warning text-danger';
    return;
  }
  
  // แสดงกล่องขออนุญาตใช้ตำแหน่ง
  showLocationPermissionDialog(function(allowed) {
    if (allowed) {
      // ดึงตำแหน่งปัจจุบันก่อนลงเวลา
      getlocation(true, function(success) {
        if (success) {
          // ดำเนินการลงเวลาออกเมื่อได้ตำแหน่งแล้ว
          ClockOut();
        } else {
          $('#message').html('ไม่สามารถดึงตำแหน่งพิกัดได้ กรุณาตรวจสอบการตั้งค่าอุปกรณ์ของคุณ');
          document.getElementById('message').className = 'alert alert-danger';
        }
      });
    } else {
      // กรณีไม่อนุญาตใช้ตำแหน่ง
      $('#message').html('คุณไม่อนุญาตการใช้งานตำแหน่งที่ตั้ง การลงเวลาจะไม่มีข้อมูลพิกัด');
      document.getElementById('message').className = 'alert alert-warning';
      
      // ลงเวลาแม้ไม่มีพิกัด
      setTimeout(function() {
        ClockOut();
      }, 1500);
    }
  });
}

// ฟังก์ชันแสดงกล่องขออนุญาตใช้ตำแหน่งแบบสวยงาม
function showLocationPermissionDialog(callback) {
  // ถ้าเคยอนุญาตแล้ว ไม่ต้องแสดงกล่องอีก
  if (locationPermissionGranted) {
    callback(true);
    return;
  }
  
  // สร้าง Modal dialog สำหรับขออนุญาตใช้ตำแหน่ง
  var modalHtml = `
  <div class="modal fade" id="locationPermissionModal" tabindex="-1" role="dialog" aria-labelledby="locationPermissionModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered" role="document">
      <div class="modal-content">
        <div class="modal-header bg-primary text-white">
          <h5 class="modal-title" id="locationPermissionModalLabel">
            <i class="fas fa-map-marker-alt mr-2"></i> ขออนุญาตใช้ตำแหน่งที่ตั้ง
          </h5>
          <button type="button" class="close text-white" data-dismiss="modal" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="modal-body">
          <div class="text-center mb-4">
            <img src="https://cdn-icons-png.flaticon.com/512/4781/4781517.png" alt="Location" style="width: 100px; height: 100px;">
          </div>
          <p class="lead text-center">ระบบต้องการเข้าถึงตำแหน่งที่ตั้งของคุณเพื่อบันทึกพิกัดการลงเวลา</p>
          <p class="text-muted text-center">ข้อมูลนี้จะถูกใช้เพื่อยืนยันตำแหน่งที่คุณลงเวลาเท่านั้น</p>
        </div>
        <div class="modal-footer justify-content-center">
          <button type="button" class="btn btn-secondary px-4" data-dismiss="modal" id="denyLocationBtn">
            <i class="fas fa-times mr-2"></i> ไม่อนุญาต
          </button>
          <button type="button" class="btn btn-primary px-4" id="allowLocationBtn">
            <i class="fas fa-check mr-2"></i> อนุญาต
          </button>
        </div>
      </div>
    </div>
  </div>
  `;
  
  // เพิ่ม Modal เข้าไปใน body
  $('body').append(modalHtml);
  
  // แสดง Modal
  $('#locationPermissionModal').modal({
    backdrop: 'static',
    keyboard: false
  });
  
  // จัดการเมื่อกดปุ่มอนุญาต
  $('#allowLocationBtn').on('click', function() {
    $('#locationPermissionModal').modal('hide');
    locationPermissionGranted = true;
    setTimeout(function() {
      $('#locationPermissionModal').remove();
      callback(true);
    }, 300);
  });
  
  // จัดการเมื่อกดปุ่มไม่อนุญาต
  $('#denyLocationBtn').on('click', function() {
    $('#locationPermissionModal').modal('hide');
    setTimeout(function() {
      $('#locationPermissionModal').remove();
      callback(false);
    }, 300);
  });
  
  // จัดการเมื่อปิด Modal โดยวิธีอื่น
  $('#locationPermissionModal').on('hidden.bs.modal', function() {
    setTimeout(function() {
      $('#locationPermissionModal').remove();
      callback(false);
    }, 300);
  });
}

// ปรับปรุงฟังก์ชัน ClockIn
function ClockIn() {
  var employee = document.getElementById("employee").value;
  var userinfo = document.getElementById("userinfo").value;

  if (employee != '') {
    $('#message').html("<span class='spinner-border spinner-border-sm text-primary'></span> โปรดรอสักครู่ ...!");
    
    // ข้อมูลที่จะส่งไปยัง API
    const clientTime = getClientTime(); // เรียกฟังก์ชันดึงเวลา
    
    const apiData = {
      employee,
      userinfo,
      lat: gps ? gps[0] : null,
      lon: gps ? gps[1] : null,
      client_time: clientTime // เพิ่มเวลาจากไคลเอ็นต์
    };
    
    // เพิ่มข้อมูล LINE ถ้ามี profile
    if (profile) {
      apiData.line_name = profile.displayName;
      apiData.line_picture = profile.pictureUrl;
    }
    
    // เพิ่มการแสดงข้อมูลการส่ง
    console.group('Clock In Request');
    console.log('API Data:', apiData);
    console.log('Sent Client Time:', clientTime);
    console.groupEnd();
    
    $.ajax({
      method: 'POST',
      url: scripturl + "/clockin",
      data: apiData,
      success: function (res) {
        // เพิ่มการแสดงข้อมูลการตอบกลับ
        console.group('Clock In Response');
        console.log('Server Response:', res);
        console.groupEnd();
        
        console.log(res);
        
        if (res.msg == 'SUCCESS') {
          if (profile) {
            // ส่งแจ้งเตือนถ้ามี profile
            $.ajax({
              method: 'POST',
              url: scripturl + "/sendnotify",
              data: {
                message: res.message,
                token: res.token,
                lat: gps ? gps[0] : null,
                lon: gps ? gps[1] : null,
              }
            });
          }

          setTimeout(() => {
            // ใช้ค่า return_date จาก server โดยตรงไม่ต้องแปลงอีก
            var returnDate = res.return_date;
            
            var message = res.employee + '<br> บันทึกเวลามา ' + returnDate;
            $('#message').html(message);
            document.getElementById("message").className = "alert alert-primary";
            clearForm();
          }, 500);
        } else {
          var message = res.employee + ' ' + res.msg;
          $('#message').html(message);
          document.getElementById("message").className = "alert alert-warning";
          clearForm();
        }
      },
      error: function(xhr, status, error) {
        // เพิ่มการจัดการข้อผิดพลาด
        console.error('Clock In Error:', status, error);
        console.log('Response Text:', xhr.responseText);
        
        $('#message').html('เกิดข้อผิดพลาดในการส่งข้อมูล');
        document.getElementById("message").className = "alert alert-danger";
        clearForm();
      }
    });
  } else {
    $('#message').html('กรุณาเลือกรายชื่อพนักงาน ...!');
    document.getElementById('message').className = 'alert alert-warning text-danger';
    clearForm();
  }
}

// ปรับปรุงฟังก์ชัน ClockOut
function ClockOut() {
  var employee = document.getElementById("employee").value;

  if (employee != '') {
    $('#message').html("<span class='spinner-border spinner-border-sm text-warning'></span> โปรดรอสักครู่ ...!");
    
    // ข้อมูลที่จะส่งไปยัง API
    const clientTime = getClientTime(); // เรียกฟังก์ชันดึงเวลา
    
    const apiData = {
      employee,
      lat: gps ? gps[0] : null,
      lon: gps ? gps[1] : null,
      client_time: clientTime // เพิ่มเวลาจากไคลเอ็นต์
    };
    
    // เพิ่มข้อมูล LINE ถ้ามี profile
    if (profile) {
      apiData.line_name = profile.displayName;
      apiData.line_picture = profile.pictureUrl;
    }
    
    // เพิ่มการแสดงข้อมูลการส่ง
    console.group('Clock Out Request');
    console.log('API Data:', apiData);
    console.log('Sent Client Time:', clientTime);
    console.groupEnd();
    
    $.ajax({
      method: 'POST',
      url: scripturl + "/clockout",
      data: apiData,
      success: function (res) {
        // เพิ่มการแสดงข้อมูลการตอบกลับ
        console.group('Clock Out Response');
        console.log('Server Response:', res);
        console.groupEnd();
        
        console.log(res);
        
        if (res.msg == 'SUCCESS') {
          if (profile) {
            // ส่งแจ้งเตือนถ้ามี profile
            $.ajax({
              method: 'POST',
              url: scripturl + "/sendnotify",
              data: {
                message: res.message,
                token: res.token,
                lat: gps ? gps[0] : null,
                lon: gps ? gps[1] : null,
              }
            });
          }

          setTimeout(() => {
            // ใช้ค่า return_date จาก server โดยตรงไม่ต้องแปลงอีก
            var returnDate = res.return_date;
            
            var message = res.employee + '<br> บันทึกเวลากลับ ' + returnDate;
            $('#message').html(message);
            document.getElementById("message").className = "alert alert-primary";
            clearForm();
          }, 500);
        } else {
          var message = res.employee + ' ' + res.msg;
          $('#message').html(message);
          document.getElementById("message").className = "alert alert-warning";
          clearForm();
        }
      },
      error: function(xhr, status, error) {
        // เพิ่มการจัดการข้อผิดพลาด
        console.error('Clock Out Error:', status, error);
        console.log('Response Text:', xhr.responseText);
        
        $('#message').html('เกิดข้อผิดพลาดในการส่งข้อมูล');
        document.getElementById("message").className = "alert alert-danger";
        clearForm();
      }
    });
  } else {
    $('#message').html("กรุณาเลือกรายชื่อพนักงาน ...!");
    document.getElementById("message").className = "alert alert-warning text-danger";
    clearForm();
  }
}

// ปรับปรุงฟังก์ชันดึงตำแหน่ง GPS
function getlocation(forceUpdate = false, callback = null) {
  // ถ้าไม่ได้บังคับอัปเดต และมีพิกัดอยู่แล้ว ให้ใช้ค่าเดิม
  if (!forceUpdate && gps) {
    console.log("Using cached GPS coordinates:", gps);
    if (callback) callback(true);
    return;
  }
  
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      // กรณีสำเร็จ
      function(position) {
        var lat = position.coords.latitude;
        var lon = position.coords.longitude;
        gps = [lat, lon];
        console.log("Geolocation success - Latitude: " + lat + ", Longitude: " + lon);
        
        // อัปเดตสถานะการอนุญาตใช้ตำแหน่ง
        locationPermissionGranted = true;
        
        if (callback) callback(true);
      },
      // กรณีไม่สำเร็จ
      function(error) {
        console.error("Geolocation error:", error);
        
        // ลองใช้วิธีสำรอง
        try {
          getLocationFromApi(function(success) {
            if (success) {
              console.log("Got location from API:", gps);
              if (callback) callback(true);
            } else {
              // หากไม่สามารถดึงตำแหน่งได้จากทุกวิธี
              console.error("Failed to get location from all methods");
              if (callback) callback(false);
            }
          });
        } catch (err) {
          console.error("Error getting location from API:", err);
          if (callback) callback(false);
        }
      },
      // ตัวเลือกการดึงตำแหน่ง
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  } else {
    console.error("Geolocation is not supported by this browser.");
    
    // ลองใช้วิธีสำรอง
    try {
      getLocationFromApi(function(success) {
        if (success) {
          console.log("Got location from API as fallback:", gps);
          if (callback) callback(true);
        } else {
          console.error("Failed to get location from API fallback");
          if (callback) callback(false);
        }
      });
    } catch (err) {
      console.error("Error getting location from API fallback:", err);
      if (callback) callback(false);
    }
  }
}

// ปรับปรุงฟังก์ชัน getLocationFromApi ให้รองรับ callback
function getLocationFromApi(callback = null) {
  $.getJSON('https://ipapi.co/json/')
    .done(function(data) {
      var lat = data.latitude;
      var lon = data.longitude;
      gps = [lat, lon];
      console.log("IP API Location - Latitude: " + lat + ", Longitude: " + lon);
      if (callback) callback(true);
      return true;
    })
    .fail(function(jqxhr, textStatus, error) {
      console.error("Error fetching location from IP API:", error);
      if (callback) callback(false);
      return false;
    });
}

// ฟังก์ชันล้างฟอร์ม
function clearForm() {
  setTimeout(function () {
    document.getElementById('message').innerText = owner;
    document.getElementById("message").className = "alert msgBg";
    document.getElementById("myForm").reset();
  }, 5000);
}

// ฟังก์ชันแสดงเวลา
function showTime() {
  var date = new Date();
  var h = date.getHours(); // 0 - 23 (เวลาท้องถิ่น)
  var m = date.getMinutes(); // 0 - 59
  var s = date.getSeconds(); // 0 - 59
  var dot = document.textContent = '.';

  // ควบคุมจุดกระพริบ
  if (s % 2 == 1) {
    dot = document.textContent = '.';
  } else {
    dot = document.textContent = '\xa0';
  }

  // เพิ่ม 0 นำหน้าตัวเลขถ้าจำเป็น
  h = h < 10 ? "0" + h : h;
  m = m < 10 ? "0" + m : m;
  s = s < 10 ? "0" + s : s;

  // แสดงเวลา
  var time = h + ":" + m + ":" + s + '' + dot;
  document.getElementById("MyClockDisplay").innerText = time;
  document.getElementById("MyClockDisplay").textContent = time;

  // เรียกฟังก์ชันนี้ทุก 1 วินาที
  setTimeout(showTime, 1000);
}

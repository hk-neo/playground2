Feature: 

	#PN(Person Name) VR 타입에서 성, 이름, 미들네임 등 구성 요소가 구분자(^)와 함께 인코딩 규칙에 따라 정확히 분리 및 디코딩되는지 확인한다.
	@TEST_PLAYG-2525 @TESTSET_PLAYG-2476 @AI
	Scenario: PN(Person Name) VR 데이터 읽기 정확성 검증
		Given 시스템이 DICOM 표준에 따른 PN(Person Name) VR 데이터를 포함한 파일을 로드한 상태이고
		And 데이터 요소가 성, 이름, 미들네임을 구분하는 구분자(^)를 포함하여 인코딩되어 있을 때
		When 시스템이 해당 PN VR 데이터를 읽고 디코딩 프로세스를 실행하면
		Then 시스템은 구분자를 기준으로 각 구성 요소를 정확히 분리하고
		And 인코딩 규칙에 따라 디코딩된 성, 이름, 미들네임 값을 반환한다.
		
	#Explicit VR Little Endian 전송 구문으로 작성된 DICOM 파일을 읽을 때, 파일에 명시된 VR 정보를 바탕으로 데이터 요소를 정확히 디코딩하는지 확인한다.
	@TEST_PLAYG-2518 @TESTSET_PLAYG-2476 @AI
	Scenario: Explicit VR Little Endian 전송 구문 해석 검증
		Given 시스템이 DICOM 파일을 읽을 준비가 되어 있고
		And 파일이 Explicit VR Little Endian 전송 구문으로 작성되어 있으며
		And 각 데이터 요소에 VR(Value Representation) 정보가 명시되어 있을 때
		When 시스템이 해당 DICOM 파일을 로드하고 데이터 요소를 파싱하면
		Then 시스템은 파일에 명시된 VR 정보를 바탕으로 각 데이터 요소를 정확하게 디코딩하고
		And 데이터의 태그, VR, 길이에 맞춰 값을 올바르게 해석한다.
		
	#서로 다른 해상도나 픽셀 간격을 가진 DICOM 슬라이스들이 혼합된 경우, 표준화된 볼륨 데이터로 통합되는 과정의 정밀도를 검증한다.
	@TEST_PLAYG-2517 @TESTSET_PLAYG-2476 @AI
	Scenario: 이종 규격 슬라이스 혼합 시 볼륨 통합 정확도 검증
		Given 사용자가 의료 영상 통합 시스템에 접속해 있고
		And 서로 다른 해상도와 픽셀 간격을 가진 DICOM 슬라이스 세트들이 준비되어 있으며
		And 시스템이 이종 규격 슬라이스들을 하나의 볼륨 데이터로 병합하도록 설정된 상태에서
		When 사용자가 이종 규격 슬라이스들에 대한 볼륨 통합 프로세스를 실행하면
		Then 시스템은 모든 슬라이스를 표준화된 좌표계와 해상도로 재샘플링하여 통합하고
		And 생성된 볼륨 데이터의 총 부피 수치가 개별 슬라이스 데이터의 합산 표준 오차 범위 내에서 일치함을 검증한다.
		
